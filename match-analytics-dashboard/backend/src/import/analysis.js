import { key } from './normalizers.js'
import { validateRows } from './rowValidator.js'

const fmt = (v) => (v === null || v === undefined ? '' : Number(v).toFixed(2))

// Clé d'un événement déjà enregistré en base (utilisée pour détecter les doublons).
export const dbEventKey = (e) =>
  [e.event_type, e.team_id, e.player_id ?? '', e.match_minute, e.match_second, fmt(e.x), fmt(e.y)].join('|')

// Analyse complète d'un fichier : validation des lignes, joueurs, doublons, cohérence avec le score.
// Fonction pure : le contexte (joueurs et événements existants) est fourni par l'appelant.
export function analyzeRows({ match, parsed, mapping, options, ctx }) {
  const { records, errors, warnings } = validateRows({
    parsed,
    mapping,
    options,
    home: match.home,
    away: match.away,
  })
  const teamId = (side) => (side === 'home' ? match.home.id : match.away.id)

  const newPlayers = new Map()
  const seen = new Set()
  const toImport = []
  const byType = {}
  const goals = { home: 0, away: 0 }
  let hasShots = false
  let duplicatesInFile = 0
  let duplicatesInDb = 0
  let skippedDuplicates = 0

  for (const rec of records) {
    const pKey = rec.playerName ? key(rec.playerName) : ''
    const existingId = pKey ? ctx.playerIndex[rec.side].get(pKey) : undefined
    rec.playerKey = pKey
    rec.playerId = existingId ?? null

    if (rec.eventType === 'shot') {
      hasShots = true
      if (rec.outcome === 'goal') goals[rec.side]++
    }

    const coords = `${fmt(rec.x)}|${fmt(rec.y)}`
    const playerPart = pKey ? (existingId ?? `new:${pKey}`) : ''
    const fileKey = `${rec.eventType}|${rec.side}|${playerPart}|${rec.minute}|${rec.second}|${coords}`
    if (seen.has(fileKey)) duplicatesInFile++
    seen.add(fileKey)

    const playerKnown = !pKey || existingId !== undefined
    const dbKey = `${rec.eventType}|${teamId(rec.side)}|${existingId ?? ''}|${rec.minute}|${rec.second}|${coords}`
    if (playerKnown && ctx.existingKeys.has(dbKey)) {
      duplicatesInDb++
      if (options.duplicatePolicy === 'skip_existing') {
        skippedDuplicates++
        continue
      }
    }

    if (pKey && existingId === undefined) {
      const nk = `${rec.side}|${pKey}`
      if (!newPlayers.has(nk)) {
        newPlayers.set(nk, { side: rec.side, name: rec.playerName, shirtNumber: rec.shirtNumber })
      }
    }

    toImport.push(rec)
    byType[rec.eventType] = (byType[rec.eventType] ?? 0) + 1
  }

  let goalsCheck = null
  if (hasShots && (goals.home !== match.homeScore || goals.away !== match.awayScore)) {
    goalsCheck = {
      file: { home: goals.home, away: goals.away },
      match: { home: match.homeScore, away: match.awayScore },
    }
  }

  return {
    records,
    toImport,
    newPlayers,
    summary: {
      totalRows: parsed.rows.length,
      validRows: records.length,
      errorRows: errors.length,
      willImport: toImport.length,
      skippedDuplicates,
      duplicatesInFile,
      duplicatesInDb,
      byType,
      newPlayerNames: [...newPlayers.values()].map((p) => p.name).slice(0, 10),
      newPlayerCount: newPlayers.size,
      warnings,
      goalsCheck,
      errors: errors.slice(0, 50),
      errorsTruncated: Math.max(0, errors.length - 50),
    },
  }
}
