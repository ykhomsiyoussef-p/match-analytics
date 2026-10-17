import { pool, withTransaction } from '../db/pool.js'
import { HttpError } from '../utils/httpError.js'
import { getMatchFull as getMatch } from './match.service.js'
import { logAudit } from './audit.service.js'
import { key } from '../import/normalizers.js'
import { IMPORT_FIELDS, suggestMapping, suggestScale } from '../import/importFields.js'
import { parseCsvText, assertMapping } from '../import/csvParser.js'
import { analyzeRows, dbEventKey } from '../import/analysis.js'

const CHUNK = 500

// Joueurs et événements déjà présents : nécessaires pour relier les joueurs et repérer les doublons.
async function loadContext(db, match) {
  const playersResult = await db.query(
    'SELECT id, team_id, full_name FROM players WHERE team_id = ANY($1::int[])',
    [[match.home.id, match.away.id]]
  )
  const playerIndex = { home: new Map(), away: new Map() }
  for (const p of playersResult.rows) {
    const side = p.team_id === match.home.id ? 'home' : 'away'
    playerIndex[side].set(key(p.full_name), p.id)
  }

  const eventsResult = await db.query(
    `SELECT event_type, team_id, player_id, match_minute, match_second, x, y
     FROM match_events WHERE match_id = $1`,
    [match.id]
  )
  const existingKeys = new Set(eventsResult.rows.map(dbEventKey))

  return { playerIndex, existingKeys }
}

export async function previewImport(user, matchId, csv) {
  const match = await getMatch(user, matchId)
  const parsed = parseCsvText(csv)
  const suggestedMapping = suggestMapping(parsed.headers)

  return {
    delimiter: parsed.delimiter,
    headers: parsed.headers,
    totalRows: parsed.rows.length,
    sampleRows: parsed.rows.slice(0, 8).map((r) => parsed.headers.map((_, i) => String(r[i] ?? ''))),
    fields: IMPORT_FIELDS.map((f) => ({ key: f.key, label: f.label, required: f.required, help: f.help })),
    suggestedMapping,
    suggestedScale: suggestScale(parsed, suggestedMapping),
    teams: { home: match.home.name, away: match.away.name },
  }
}

export async function validateImport(user, matchId, { csv, mapping, options }) {
  const match = await getMatch(user, matchId)
  const parsed = parseCsvText(csv)
  assertMapping(parsed, mapping)
  const ctx = await loadContext(pool, match)
  return analyzeRows({ match, parsed, mapping, options, ctx }).summary
}

// Insertion par paquets : un seul aller-retour pour 500 lignes.
async function insertChunks(client, rows, toParams, sqlPrefix, paramsPerRow, returning = '') {
  const results = []
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const params = []
    const tuples = chunk.map((row, j) => {
      const base = j * paramsPerRow
      params.push(...toParams(row))
      const placeholders = Array.from({ length: paramsPerRow }, (_, k) => `$${base + k + 1}`)
      return `(${placeholders.join(',')})`
    })
    const res = await client.query(`${sqlPrefix} VALUES ${tuples.join(',')} ${returning}`, params)
    results.push(...res.rows)
  }
  return results
}

export async function commitImport(user, matchId, { csv, mapping, options, fileName }, ip) {
  const match = await getMatch(user, matchId)
  const parsed = parseCsvText(csv)
  assertMapping(parsed, mapping)

  return withTransaction(async (client) => {
    // L'analyse est refaite côté serveur : on ne fait jamais confiance au rapport du navigateur.
    const ctx = await loadContext(client, match)
    const { toImport, newPlayers, summary } = analyzeRows({ match, parsed, mapping, options, ctx })

    if (toImport.length === 0) {
      throw new HttpError(400, 'Aucune ligne valide à importer.')
    }

    const teamId = (side) => (side === 'home' ? match.home.id : match.away.id)

    // 1. Joueurs inconnus : création.
    const newPlayerIds = new Map()
    for (const [nk, p] of newPlayers) {
      const r = await client.query(
        'INSERT INTO players (team_id, full_name, shirt_number) VALUES ($1, $2, $3) RETURNING id',
        [teamId(p.side), p.name, p.shirtNumber]
      )
      newPlayerIds.set(nk, r.rows[0].id)
    }

    // 2. Lot d'import (permet l'annulation).
    const batch = await client.query(
      `INSERT INTO import_batches
         (match_id, imported_by, file_name, total_rows, imported_rows, skipped_rows, error_rows)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [match.id, user.id, fileName || null, summary.totalRows, toImport.length, summary.skippedDuplicates, summary.errorRows]
    )
    const batchId = batch.rows[0].id

    // 3. Événements.
    const playerIdOf = (r) => r.playerId ?? newPlayerIds.get(`${r.side}|${r.playerKey}`) ?? null
    const inserted = await insertChunks(
      client,
      toImport,
      (r) => [
        match.id, teamId(r.side), playerIdOf(r), r.eventType, r.period, r.minute, r.second,
        r.videoTime, r.x, r.y, r.outcome, JSON.stringify(r.metadata), batchId, 'csv',
      ],
      `INSERT INTO match_events
         (match_id, team_id, player_id, event_type, period, match_minute, match_second,
          video_time_seconds, x, y, outcome, metadata, import_batch_id, source)`,
      14,
      "RETURNING id, (metadata->>'csv_row')::int AS csv_row"
    )
    const idByRow = new Map(inserted.map((r) => [r.csv_row, r.id]))

    // 4. Détails des tirs et des passes.
    await insertChunks(
      client,
      toImport.filter((r) => r.eventType === 'shot'),
      (r) => [idByRow.get(r.csvRow), r.outcome, r.xg, r.bodyPart, r.endX, r.endY],
      'INSERT INTO shots (match_event_id, outcome, xg, body_part, end_x, end_y)',
      6
    )
    await insertChunks(
      client,
      toImport.filter((r) => r.eventType === 'pass'),
      (r) => [idByRow.get(r.csvRow), r.passSuccess, r.keyPass, r.endX, r.endY],
      'INSERT INTO passes (match_event_id, success, is_key_pass, end_x, end_y)',
      5
    )

    await logAudit({
      client,
      userId: user.id,
      action: 'events_imported',
      entityType: 'match',
      entityId: match.id,
      details: { batchId, fileName: fileName || null, imported: toImport.length, skipped: summary.skippedDuplicates, errors: summary.errorRows },
      ip,
    })

    return {
      batchId,
      totalRows: summary.totalRows,
      importedRows: toImport.length,
      skippedDuplicates: summary.skippedDuplicates,
      errorRows: summary.errorRows,
      byType: summary.byType,
      newPlayerCount: newPlayers.size,
    }
  })
}

export async function listImports(user, matchId) {
  const match = await getMatch(user, matchId)
  const { rows } = await pool.query(
    `SELECT b.id, b.file_name, b.total_rows, b.imported_rows, b.skipped_rows, b.error_rows,
            b.created_at, u.full_name AS imported_by
     FROM import_batches b
     JOIN users u ON u.id = b.imported_by
     WHERE b.match_id = $1
     ORDER BY b.id DESC`,
    [match.id]
  )
  return rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    totalRows: r.total_rows,
    importedRows: r.imported_rows,
    skippedRows: r.skipped_rows,
    errorRows: r.error_rows,
    createdAt: r.created_at,
    importedBy: r.imported_by,
  }))
}

// Annule un import : supprime les événements de ce lot (les joueurs créés sont conservés).
export async function undoImport(user, matchId, batchId, ip) {
  return withTransaction(async (client) => {
    const match = await getMatch(user, matchId, client)
    const batch = await client.query('SELECT id FROM import_batches WHERE id = $1 AND match_id = $2', [batchId, match.id])
    if (!batch.rows[0]) throw new HttpError(404, 'Import introuvable')

    const deleted = await client.query(
      'DELETE FROM match_events WHERE import_batch_id = $1 AND match_id = $2',
      [batchId, match.id]
    )
    await client.query('DELETE FROM import_batches WHERE id = $1', [batchId])
    await logAudit({
      client,
      userId: user.id,
      action: 'import_undone',
      entityType: 'match',
      entityId: match.id,
      details: { batchId, deletedEvents: deleted.rowCount },
      ip,
    })
    return { deletedEvents: deleted.rowCount }
  })
}
