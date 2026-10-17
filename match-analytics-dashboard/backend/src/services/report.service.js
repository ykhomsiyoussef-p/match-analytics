import { pool, withTransaction } from '../db/pool.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'
import { getMatch, getMatchFull, getMatchDataset } from './match.service.js'
import { logAudit } from './audit.service.js'
import { signClipUrl } from './clip.service.js'
import { reportPermissions, nextStatus, TRANSITIONS } from '../reports/workflow.js'
import { buildReportPdf } from '../reports/pdf.js'

const num = (v) => (v === null || v === undefined ? null : Number(v))

const REPORT_SELECT = `
  SELECT r.id, r.match_id, r.author_id, r.status, r.summary, r.strengths, r.weaknesses,
         r.tactical_issues, r.individual_performances, r.recommendations,
         r.validated_by, r.validated_at, r.shared_at, r.created_at, r.updated_at,
         m.created_by AS match_owner_id,
         u.full_name AS author_name, vu.full_name AS validated_by_name
  FROM analysis_reports r
  JOIN matches m ON m.id = r.match_id
  JOIN users u ON u.id = r.author_id
  LEFT JOIN users vu ON vu.id = r.validated_by`

// Charge le rapport et calcule ce que cette personne a le droit d'en faire.
// Un rapport auquel on n'a pas accès est présenté comme introuvable (on ne révèle pas son existence).
async function loadAccess(user, reportId) {
  const { rows } = await pool.query(`${REPORT_SELECT} WHERE r.id = $1`, [reportId])
  const row = rows[0]
  if (!row) throw new HttpError(404, 'Rapport introuvable')
  const shareResult = await pool.query(
    'SELECT can_comment FROM report_shares WHERE report_id = $1 AND user_id = $2',
    [reportId, user.id]
  )
  const share = shareResult.rows[0] ? { canComment: shareResult.rows[0].can_comment } : null
  const perms = reportPermissions({
    user,
    report: { authorId: row.author_id, status: row.status },
    isMatchOwner: row.match_owner_id === user.id,
    share,
  })
  if (!perms.canView) throw new HttpError(404, 'Rapport introuvable')
  return { row, perms }
}

async function loadLinks(reportId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.section, l.annotation_id, l.clip_id,
            a.title AS a_title, a.category AS a_category, a.start_time_seconds AS a_start, a.end_time_seconds AS a_end,
            c.title AS c_title, c.category AS c_category, c.start_time_seconds AS c_start,
            c.end_time_seconds AS c_end, c.status AS c_status
     FROM report_links l
     LEFT JOIN video_annotations a ON a.id = l.annotation_id
     LEFT JOIN video_clips c ON c.id = l.clip_id
     WHERE l.report_id = $1 ORDER BY l.id`,
    [reportId]
  )
  return rows.map((r) => ({
    section: r.section,
    annotation: r.annotation_id
      ? { id: r.annotation_id, title: r.a_title, category: r.a_category, startTimeSeconds: num(r.a_start), endTimeSeconds: num(r.a_end) }
      : null,
    clip: r.clip_id
      ? { id: r.clip_id, title: r.c_title, category: r.c_category, startTimeSeconds: num(r.c_start), endTimeSeconds: num(r.c_end), status: r.c_status }
      : null,
  }))
}

const toReport = (row) => ({
  id: row.id,
  matchId: row.match_id,
  authorId: row.author_id,
  authorName: row.author_name,
  status: row.status,
  summary: row.summary,
  strengths: row.strengths,
  weaknesses: row.weaknesses,
  tacticalIssues: row.tactical_issues,
  individualPerformances: row.individual_performances,
  recommendations: row.recommendations,
  validatedByName: row.validated_by_name,
  validatedAt: row.validated_at,
  sharedAt: row.shared_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function listReports(user, matchId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.match_id, r.status, r.updated_at, r.author_id, u.full_name AS author_name,
            to_char(m.match_date, 'YYYY-MM-DD') AS match_date, m.home_score, m.away_score, m.is_demo,
            ht.name AS home_name, aw.name AS away_name
     FROM analysis_reports r
     JOIN matches m ON m.id = r.match_id
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams aw ON aw.id = m.away_team_id
     JOIN users u ON u.id = r.author_id
     WHERE ($1::text = 'admin' OR r.author_id = $2 OR m.created_by = $2
            OR (r.status = 'partage' AND EXISTS (
                  SELECT 1 FROM report_shares s WHERE s.report_id = r.id AND s.user_id = $2)))
       AND ($3::int IS NULL OR r.match_id = $3)
     ORDER BY r.updated_at DESC, r.id DESC`,
    [user.role, user.id, matchId ?? null]
  )
  return rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    status: r.status,
    updatedAt: r.updated_at,
    authorName: r.author_name,
    isAuthor: r.author_id === user.id,
    matchDate: r.match_date,
    isDemo: r.is_demo,
    home: { name: r.home_name },
    away: { name: r.away_name },
    homeScore: r.home_score,
    awayScore: r.away_score,
  }))
}

export async function createReport(user, matchId, ip) {
  const match = await getMatchFull(user, matchId)
  const { rows } = await pool.query(
    "INSERT INTO analysis_reports (match_id, author_id, status) VALUES ($1, $2, 'brouillon') RETURNING id",
    [match.id, user.id]
  )
  await logAudit({ userId: user.id, action: 'report_created', entityType: 'report', entityId: rows[0].id, details: { matchId: match.id }, ip })
  return getReport(user, rows[0].id)
}

export async function getReport(user, reportId) {
  const { row, perms } = await loadAccess(user, reportId)
  const match = await getMatch(user, row.match_id)
  const links = await loadLinks(row.id)

  let shares = []
  if (perms.isManager) {
    const s = await pool.query(
      `SELECT s.user_id, s.can_comment, u.full_name, u.email, u.role
       FROM report_shares s JOIN users u ON u.id = s.user_id
       WHERE s.report_id = $1 ORDER BY u.full_name`,
      [row.id]
    )
    shares = s.rows.map((r) => ({ userId: r.user_id, canComment: r.can_comment, fullName: r.full_name, email: r.email, role: r.role }))
  }

  // Les destinataires ne voient les commentaires que tant que le rapport est partagé.
  let comments = []
  if (perms.isManager || row.status === 'partage') {
    const c = await pool.query(
      `SELECT c.id, c.body, c.created_at, c.author_id, u.full_name, u.role
       FROM report_comments c JOIN users u ON u.id = c.author_id
       WHERE c.report_id = $1 ORDER BY c.id`,
      [row.id]
    )
    comments = c.rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at, authorName: r.full_name, authorRole: r.role, mine: r.author_id === user.id }))
  }

  return { report: toReport(row), match, links, shares, comments, permissions: perms }
}

// Vérifie que les annotations et clips cités appartiennent bien à ce match.
async function validateLinks(matchId, links) {
  const annotationIds = [...new Set(links.filter((l) => l.annotationId).map((l) => l.annotationId))]
  const clipIds = [...new Set(links.filter((l) => l.clipId).map((l) => l.clipId))]
  if (annotationIds.length > 0) {
    const { rows } = await pool.query('SELECT id FROM video_annotations WHERE id = ANY($1::int[]) AND match_id = $2', [annotationIds, matchId])
    if (rows.length !== annotationIds.length) throw new HttpError(400, 'Annotation invalide pour ce match')
  }
  if (clipIds.length > 0) {
    const { rows } = await pool.query('SELECT id FROM video_clips WHERE id = ANY($1::int[]) AND match_id = $2', [clipIds, matchId])
    if (rows.length !== clipIds.length) throw new HttpError(400, 'Clip invalide pour ce match')
  }
}

export async function updateReport(user, reportId, input, ip) {
  const { row, perms } = await loadAccess(user, reportId)
  if (!perms.canEdit) throw new HttpError(409, "Ce rapport n'est plus modifiable : rouvrez-le en brouillon pour le modifier")
  await validateLinks(row.match_id, input.links)

  // On retire les doublons exacts (même section, même élément).
  const seen = new Set()
  const links = input.links.filter((l) => {
    const k = `${l.section}|${l.annotationId ?? ''}|${l.clipId ?? ''}`
    return seen.has(k) ? false : seen.add(k)
  })

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE analysis_reports
       SET summary = $1, strengths = $2, weaknesses = $3, tactical_issues = $4,
           individual_performances = $5, recommendations = $6, updated_at = now()
       WHERE id = $7`,
      [
        input.summary || null, input.strengths || null, input.weaknesses || null, input.tacticalIssues || null,
        input.individualPerformances || null, input.recommendations || null, row.id,
      ]
    )
    await client.query('DELETE FROM report_links WHERE report_id = $1', [row.id])
    if (links.length > 0) {
      await client.query(
        `INSERT INTO report_links (report_id, section, annotation_id, clip_id)
         SELECT $1::int, t.section, t.annotation_id, t.clip_id
         FROM unnest($2::text[], $3::int[], $4::int[]) AS t(section, annotation_id, clip_id)`,
        [row.id, links.map((l) => l.section), links.map((l) => l.annotationId ?? null), links.map((l) => l.clipId ?? null)]
      )
    }
  })
  return getReport(user, row.id)
}

export async function transitionReport(user, reportId, action, ip) {
  const { row, perms } = await loadAccess(user, reportId)
  const result = nextStatus(action, row.status, perms)
  if (result.error) throw new HttpError(result.error.code, result.error.message)

  if (action === 'share') {
    const count = await pool.query('SELECT count(*)::int AS n FROM report_shares WHERE report_id = $1', [row.id])
    if (count.rows[0].n === 0) throw new HttpError(400, 'Choisissez au moins un destinataire avant de partager le rapport')
  }

  const sets = ['status = $1', 'updated_at = now()']
  if (action === 'validate') sets.push('validated_by = $4', 'validated_at = now()')
  if (action === 'reject' || action === 'reopen') sets.push('validated_by = NULL', 'validated_at = NULL', 'shared_at = NULL')
  if (action === 'share') sets.push('shared_at = now()')
  if (action === 'unshare') sets.push('shared_at = NULL')

  const params = [result.status, row.id, result.from]
  if (action === 'validate') params.push(user.id)
  const updated = await pool.query(
    `UPDATE analysis_reports SET ${sets.join(', ')} WHERE id = $2 AND status = ANY($3::text[])`,
    params
  )
  // Si quelqu'un a changé l'état entre-temps, on ne fait rien.
  if (updated.rowCount === 0) throw new HttpError(409, "L'état du rapport a changé : rechargez la page")

  await logAudit({ userId: user.id, action: `report_${action}`, entityType: 'report', entityId: row.id, details: { from: row.status, to: result.status }, ip })
  return getReport(user, row.id)
}

export async function setShares(user, reportId, shares, ip) {
  const { row, perms } = await loadAccess(user, reportId)
  if (!perms.canManageShares) {
    throw new HttpError(409, 'Les destinataires se choisissent une fois le rapport validé')
  }
  const unique = new Map(shares.map((s) => [s.userId, s.canComment]))
  const ids = [...unique.keys()]
  if (row.status === 'partage' && ids.length === 0) {
    throw new HttpError(400, 'Un rapport partagé doit avoir au moins un destinataire (ou retirez le partage)')
  }
  if (ids.length > 0) {
    const { rows } = await pool.query('SELECT id FROM users WHERE id = ANY($1::int[]) AND is_active AND id <> $2', [ids, row.author_id])
    if (rows.length !== ids.length) throw new HttpError(400, 'Destinataire invalide')
  }

  await withTransaction(async (client) => {
    await client.query('DELETE FROM report_shares WHERE report_id = $1', [row.id])
    if (ids.length > 0) {
      await client.query(
        `INSERT INTO report_shares (report_id, user_id, can_comment)
         SELECT $1::int, t.user_id, t.can_comment FROM unnest($2::int[], $3::boolean[]) AS t(user_id, can_comment)`,
        [row.id, ids, ids.map((i) => unique.get(i))]
      )
    }
  })
  await logAudit({ userId: user.id, action: 'report_shares_updated', entityType: 'report', entityId: row.id, details: { recipients: ids }, ip })
  return getReport(user, row.id)
}

export async function addComment(user, reportId, body, ip) {
  const { row, perms } = await loadAccess(user, reportId)
  if (!perms.canComment) throw new HttpError(403, "Vous ne pouvez pas commenter ce rapport")
  await pool.query('INSERT INTO report_comments (report_id, author_id, body) VALUES ($1, $2, $3)', [row.id, user.id, body])
  await logAudit({ userId: user.id, action: 'report_commented', entityType: 'report', entityId: row.id, ip })
  return getReport(user, row.id)
}

// Annotations et clips du match, parmi lesquels l'auteur choisit ce qu'il joint au rapport.
export async function listAttachables(user, reportId) {
  const { row, perms } = await loadAccess(user, reportId)
  if (!perms.isManager) throw new HttpError(403, 'Accès refusé')
  const annotations = await pool.query(
    `SELECT a.id, a.title, a.category, a.start_time_seconds
     FROM video_annotations a WHERE a.match_id = $1 ORDER BY a.video_id, a.start_time_seconds`,
    [row.match_id]
  )
  const clips = await pool.query(
    `SELECT c.id, c.title, c.category, c.start_time_seconds, c.end_time_seconds, c.status
     FROM video_clips c WHERE c.match_id = $1 ORDER BY c.video_id, c.start_time_seconds`,
    [row.match_id]
  )
  return {
    annotations: annotations.rows.map((r) => ({ id: r.id, title: r.title, category: r.category, startTimeSeconds: num(r.start_time_seconds) })),
    clips: clips.rows.map((r) => ({ id: r.id, title: r.title, category: r.category, startTimeSeconds: num(r.start_time_seconds), endTimeSeconds: num(r.end_time_seconds), status: r.status })),
  }
}

// Un clip ne se regarde que s'il est joint au rapport ET que la personne a le droit de voir ce rapport.
export async function createReportClipPlaybackUrl(user, reportId, clipId) {
  const { row } = await loadAccess(user, reportId)
  const { rows } = await pool.query(
    `SELECT c.id, c.status FROM report_links l JOIN video_clips c ON c.id = l.clip_id
     WHERE l.report_id = $1 AND l.clip_id = $2 LIMIT 1`,
    [row.id, clipId]
  )
  if (!rows[0]) throw new HttpError(404, 'Clip introuvable dans ce rapport')
  if (rows[0].status !== 'pret') throw new HttpError(409, "Le fichier du clip n'est pas prêt")
  return signClipUrl(user, clipId)
}

export async function buildPdf(user, reportId, ip) {
  const { row, perms } = await loadAccess(user, reportId)
  if (!perms.canDownload) throw new HttpError(403, 'Accès refusé')
  const match = await getMatch(user, row.match_id)
  const { events } = await getMatchDataset(user, row.match_id)
  const links = await loadLinks(row.id)

  const bytes = await buildReportPdf({
    report: { ...toReport(row), links },
    match,
    events,
    publicUrl: env.corsOrigin,
  })
  await logAudit({ userId: user.id, action: 'report_pdf_downloaded', entityType: 'report', entityId: row.id, ip })
  return { bytes, filename: `rapport-${row.id}.pdf` }
}

export { TRANSITIONS }
