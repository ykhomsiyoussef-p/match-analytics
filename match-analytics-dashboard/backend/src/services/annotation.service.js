import { pool } from '../db/pool.js'
import { HttpError } from '../utils/httpError.js'
import { getMatchFull as getMatch } from './match.service.js'

const ANNOTATION_SELECT = `
  SELECT a.id, a.match_id, a.video_id, a.team_id, a.player_id, a.category, a.title, a.description,
         a.start_time_seconds, a.end_time_seconds, a.author_id, a.created_at, a.updated_at,
         pl.full_name AS player_name, u.full_name AS author_name
  FROM video_annotations a
  LEFT JOIN players pl ON pl.id = a.player_id
  JOIN users u ON u.id = a.author_id`

const toAnnotation = (row, match) => ({
  id: row.id,
  matchId: row.match_id,
  videoId: row.video_id,
  teamId: row.team_id,
  teamSide: row.team_id === match.home.id ? 'home' : 'away',
  playerId: row.player_id,
  playerName: row.player_name,
  category: row.category,
  title: row.title,
  description: row.description,
  startTimeSeconds: Number(row.start_time_seconds),
  endTimeSeconds: row.end_time_seconds === null ? null : Number(row.end_time_seconds),
  authorId: row.author_id,
  authorName: row.author_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

async function ensureVideo(matchId, videoId) {
  const { rows } = await pool.query('SELECT id FROM match_videos WHERE id = $1 AND match_id = $2', [videoId, matchId])
  if (!rows[0]) throw new HttpError(404, 'Vidéo introuvable')
}

// L'équipe doit jouer ce match, et le joueur doit appartenir à cette équipe.
async function validateReferences(match, input) {
  if (input.teamId !== match.home.id && input.teamId !== match.away.id) {
    throw new HttpError(400, 'Équipe invalide pour ce match')
  }
  if (input.playerId) {
    const { rows } = await pool.query('SELECT team_id FROM players WHERE id = $1', [input.playerId])
    if (!rows[0] || rows[0].team_id !== input.teamId) {
      throw new HttpError(400, "Ce joueur n'appartient pas à l'équipe choisie")
    }
  }
}

async function getAnnotationRow(matchId, videoId, annotationId) {
  const { rows } = await pool.query(
    `${ANNOTATION_SELECT} WHERE a.id = $1 AND a.video_id = $2 AND a.match_id = $3`,
    [annotationId, videoId, matchId]
  )
  if (!rows[0]) throw new HttpError(404, 'Annotation introuvable')
  return rows[0]
}

// Seul l'administrateur ou l'auteur peut modifier ou supprimer une annotation.
function assertCanModify(user, row) {
  if (user.role !== 'admin' && row.author_id !== user.id) throw new HttpError(403, 'Accès refusé')
}

export async function listAnnotations(user, matchId, videoId) {
  const match = await getMatch(user, matchId)
  await ensureVideo(match.id, videoId)
  const { rows } = await pool.query(
    `${ANNOTATION_SELECT} WHERE a.video_id = $1 AND a.match_id = $2 ORDER BY a.start_time_seconds, a.id`,
    [videoId, match.id]
  )
  return rows.map((r) => toAnnotation(r, match))
}

export async function createAnnotation(user, matchId, videoId, input) {
  const match = await getMatch(user, matchId)
  await ensureVideo(match.id, videoId)
  await validateReferences(match, input)

  const { rows } = await pool.query(
    `INSERT INTO video_annotations
       (match_id, video_id, team_id, player_id, category, title, description,
        start_time_seconds, end_time_seconds, author_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      match.id, videoId, input.teamId, input.playerId ?? null, input.category, input.title,
      input.description || null, input.startTimeSeconds, input.endTimeSeconds ?? null, user.id,
    ]
  )
  return toAnnotation(await getAnnotationRow(match.id, videoId, rows[0].id), match)
}

export async function updateAnnotation(user, matchId, videoId, annotationId, input) {
  const match = await getMatch(user, matchId)
  const existing = await getAnnotationRow(match.id, videoId, annotationId)
  assertCanModify(user, existing)
  await validateReferences(match, input)

  await pool.query(
    `UPDATE video_annotations
     SET team_id = $1, player_id = $2, category = $3, title = $4, description = $5,
         start_time_seconds = $6, end_time_seconds = $7, updated_at = now()
     WHERE id = $8`,
    [
      input.teamId, input.playerId ?? null, input.category, input.title, input.description || null,
      input.startTimeSeconds, input.endTimeSeconds ?? null, annotationId,
    ]
  )
  return toAnnotation(await getAnnotationRow(match.id, videoId, annotationId), match)
}

export async function deleteAnnotation(user, matchId, videoId, annotationId) {
  const match = await getMatch(user, matchId)
  const existing = await getAnnotationRow(match.id, videoId, annotationId)
  assertCanModify(user, existing)
  await pool.query('DELETE FROM video_annotations WHERE id = $1', [annotationId])
}
