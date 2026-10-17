import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool, withTransaction } from '../db/pool.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'
import { getMatchFull as getMatch } from './match.service.js'
import { toPublicUser } from './auth.service.js'
import * as storage from '../storage/local.js'
import { cutClip, FfmpegError } from '../video/ffmpeg.js'
import { enqueue } from '../video/renderQueue.js'

const PLAYBACK_TOKEN_TTL = '4h'

const CLIP_SELECT = `
  SELECT c.id, c.match_id, c.video_id, c.annotation_id, c.title, c.description, c.category,
         c.start_time_seconds, c.end_time_seconds, c.status, c.error_message, c.storage_key,
         c.created_by, c.created_at, u.full_name AS created_by_name,
         COALESCE(
           json_agg(json_build_object('id', p.id, 'fullName', p.full_name) ORDER BY p.full_name)
             FILTER (WHERE p.id IS NOT NULL),
           '[]'::json
         ) AS players
  FROM video_clips c
  JOIN users u ON u.id = c.created_by
  LEFT JOIN clip_players cp ON cp.clip_id = c.id
  LEFT JOIN players p ON p.id = cp.player_id`

const toClip = (row) => ({
  id: row.id,
  matchId: row.match_id,
  videoId: row.video_id,
  annotationId: row.annotation_id,
  title: row.title,
  description: row.description,
  category: row.category,
  startTimeSeconds: Number(row.start_time_seconds),
  endTimeSeconds: Number(row.end_time_seconds),
  durationSeconds: Number(row.end_time_seconds) - Number(row.start_time_seconds),
  status: row.status,
  errorMessage: row.error_message,
  hasFile: row.status === 'pret',
  players: row.players,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  createdAt: row.created_at,
})

async function getClipRow(matchId, videoId, clipId) {
  const { rows } = await pool.query(
    `${CLIP_SELECT} WHERE c.id = $1 AND c.video_id = $2 AND c.match_id = $3 GROUP BY c.id, u.full_name`,
    [clipId, videoId, matchId]
  )
  if (!rows[0]) throw new HttpError(404, 'Clip introuvable')
  return rows[0]
}

async function ensureVideo(matchId, videoId) {
  const { rows } = await pool.query(
    'SELECT id, storage_key, processing_status FROM match_videos WHERE id = $1 AND match_id = $2',
    [videoId, matchId]
  )
  if (!rows[0]) throw new HttpError(404, 'Vidéo introuvable')
  return rows[0]
}

// Seul l'administrateur ou le créateur du clip peut le modifier.
function assertCanModify(user, row) {
  if (user.role !== 'admin' && row.created_by !== user.id) throw new HttpError(403, 'Accès refusé')
}

// Durée, annotation liée et joueurs doivent être cohérents avec ce match.
async function validateInput(match, videoId, input) {
  const duration = input.endTimeSeconds - input.startTimeSeconds
  if (duration > env.maxClipSeconds) {
    throw new HttpError(400, `Clip trop long (${env.maxClipSeconds} secondes maximum)`)
  }
  if (input.annotationId) {
    const { rows } = await pool.query(
      'SELECT id FROM video_annotations WHERE id = $1 AND video_id = $2 AND match_id = $3',
      [input.annotationId, videoId, match.id]
    )
    if (!rows[0]) throw new HttpError(400, 'Annotation invalide pour cette vidéo')
  }
  const playerIds = [...new Set(input.playerIds)]
  if (playerIds.length > 0) {
    const { rows } = await pool.query(
      'SELECT id FROM players WHERE id = ANY($1::int[]) AND team_id = ANY($2::int[])',
      [playerIds, [match.home.id, match.away.id]]
    )
    if (rows.length !== playerIds.length) throw new HttpError(400, 'Joueur invalide pour ce match')
  }
  return playerIds
}

async function setPlayers(client, clipId, playerIds) {
  await client.query('DELETE FROM clip_players WHERE clip_id = $1', [clipId])
  if (playerIds.length > 0) {
    await client.query('INSERT INTO clip_players (clip_id, player_id) SELECT $1::int, unnest($2::int[])', [clipId, playerIds])
  }
}

export async function listClips(user, matchId, videoId) {
  const match = await getMatch(user, matchId)
  await ensureVideo(match.id, videoId)
  const { rows } = await pool.query(
    `${CLIP_SELECT} WHERE c.video_id = $1 AND c.match_id = $2
     GROUP BY c.id, u.full_name ORDER BY c.start_time_seconds, c.id`,
    [videoId, match.id]
  )
  return rows.map(toClip)
}

export async function createClip(user, matchId, videoId, input) {
  const match = await getMatch(user, matchId)
  await ensureVideo(match.id, videoId)
  const playerIds = await validateInput(match, videoId, input)

  const clipId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO video_clips
         (match_id, video_id, annotation_id, title, description, category,
          start_time_seconds, end_time_seconds, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        match.id, videoId, input.annotationId ?? null, input.title, input.description || null,
        input.category, input.startTimeSeconds, input.endTimeSeconds, user.id,
      ]
    )
    await setPlayers(client, rows[0].id, playerIds)
    return rows[0].id
  })
  return toClip(await getClipRow(match.id, videoId, clipId))
}

export async function updateClip(user, matchId, videoId, clipId, input) {
  const match = await getMatch(user, matchId)
  const existing = await getClipRow(match.id, videoId, clipId)
  assertCanModify(user, existing)
  const playerIds = await validateInput(match, videoId, input)

  // Si la séquence change, le fichier généré n'est plus valable : on le supprime.
  const timesChanged =
    Number(existing.start_time_seconds) !== input.startTimeSeconds ||
    Number(existing.end_time_seconds) !== input.endTimeSeconds
  const staleKey = timesChanged ? existing.storage_key : null

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE video_clips
       SET annotation_id = $1, title = $2, description = $3, category = $4,
           start_time_seconds = $5, end_time_seconds = $6,
           status = CASE WHEN $7::boolean THEN 'selection' ELSE status END,
           storage_key = CASE WHEN $7::boolean THEN NULL ELSE storage_key END,
           error_message = CASE WHEN $7::boolean THEN NULL ELSE error_message END
       WHERE id = $8`,
      [
        input.annotationId ?? null, input.title, input.description || null, input.category,
        input.startTimeSeconds, input.endTimeSeconds, timesChanged, clipId,
      ]
    )
    await setPlayers(client, clipId, playerIds)
  })
  if (staleKey) await storage.remove(staleKey)
  return toClip(await getClipRow(match.id, videoId, clipId))
}

export async function deleteClip(user, matchId, videoId, clipId) {
  const match = await getMatch(user, matchId)
  const existing = await getClipRow(match.id, videoId, clipId)
  assertCanModify(user, existing)
  await pool.query('DELETE FROM video_clips WHERE id = $1', [clipId])
  if (existing.storage_key) await storage.remove(existing.storage_key)
}

const RENDER_ERRORS = {
  FFMPEG_MISSING: "FFmpeg n'est pas installé sur le serveur. Installez-le puis relancez la génération.",
  FFMPEG_TIMEOUT: 'Le traitement a dépassé le délai autorisé. Essayez un clip plus court.',
}

// Découpe réelle (en arrière-plan). Le fichier n'est publié (statut « pret ») qu'une fois terminé.
async function runRender(clipId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.status, c.start_time_seconds, c.end_time_seconds, v.storage_key AS video_key
     FROM video_clips c JOIN match_videos v ON v.id = c.video_id WHERE c.id = $1`,
    [clipId]
  )
  const job = rows[0]
  if (!job || job.status !== 'traitement') return // supprimé ou modifié entre-temps

  const outputKey = `${randomUUID()}.mp4`
  try {
    const start = Number(job.start_time_seconds)
    await cutClip({
      input: storage.pathOf(job.video_key),
      output: storage.pathOf(outputKey),
      start,
      duration: Number(job.end_time_seconds) - start,
      ffmpegPath: env.ffmpegPath,
      timeoutMs: env.clipRenderTimeoutMs,
    })
    const done = await pool.query(
      "UPDATE video_clips SET status = 'pret', storage_key = $1, error_message = NULL WHERE id = $2 AND status = 'traitement'",
      [outputKey, clipId]
    )
    if (done.rowCount === 0) await storage.remove(outputKey) // le clip a été modifié ou supprimé pendant le traitement
  } catch (err) {
    await storage.remove(outputKey).catch(() => {})
    const message =
      err instanceof FfmpegError && RENDER_ERRORS[err.code]
        ? RENDER_ERRORS[err.code]
        : `Échec du traitement vidéo : ${err.message}`.slice(0, 300)
    await pool.query(
      "UPDATE video_clips SET status = 'erreur', error_message = $1 WHERE id = $2 AND status = 'traitement'",
      [message, clipId]
    )
  }
}

export async function startRender(user, matchId, videoId, clipId) {
  const match = await getMatch(user, matchId)
  const video = await ensureVideo(match.id, videoId)
  const existing = await getClipRow(match.id, videoId, clipId)
  assertCanModify(user, existing)

  if (video.processing_status !== 'prete') throw new HttpError(409, "La vidéo n'est pas prête")
  if (existing.status === 'traitement') throw new HttpError(409, 'Le traitement est déjà en cours')
  if (existing.status === 'pret') throw new HttpError(409, 'Le fichier du clip existe déjà')

  const claimed = await pool.query(
    "UPDATE video_clips SET status = 'traitement', error_message = NULL WHERE id = $1 AND status IN ('selection', 'erreur')",
    [clipId]
  )
  if (claimed.rowCount === 0) throw new HttpError(409, 'Le traitement est déjà en cours')

  enqueue(clipId, () => runRender(clipId))
  return toClip(await getClipRow(match.id, videoId, clipId))
}

// Au démarrage du serveur : un traitement interrompu par un redémarrage ne doit pas rester « en cours ».
export async function recoverInterruptedClips() {
  const { rowCount } = await pool.query(
    `UPDATE video_clips
     SET status = 'erreur', error_message = 'Traitement interrompu par un redémarrage du serveur. Relancez la génération.'
     WHERE status = 'traitement'`
  )
  if (rowCount > 0) console.warn(`${rowCount} clip(s) en cours de traitement ont été marqués en erreur.`)
}

// Adresse temporaire de lecture, liée à l'utilisateur et au clip.
export function signClipUrl(user, clipId) {
  const token = jwt.sign({ purpose: 'clip', cid: clipId }, env.jwtSecret, {
    subject: String(user.id),
    expiresIn: PLAYBACK_TOKEN_TTL,
    algorithm: 'HS256',
  })
  return { url: `/api/clips/${clipId}/stream?token=${encodeURIComponent(token)}` }
}

export async function createClipPlaybackUrl(user, matchId, videoId, clipId) {
  const match = await getMatch(user, matchId)
  const row = await getClipRow(match.id, videoId, clipId)
  if (row.status !== 'pret' || !row.storage_key) throw new HttpError(409, "Le fichier du clip n'est pas prêt")
  return signClipUrl(user, row.id)
}

// Vérifié à chaque requête : jeton valide, compte actif, accès au match.
export async function authorizeClipStream(token, clipId) {
  if (!token || typeof token !== 'string') throw new HttpError(401, 'Authentification requise')
  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
  } catch {
    throw new HttpError(401, 'Lien de lecture expiré ou invalide')
  }
  if (payload.purpose !== 'clip' || payload.cid !== clipId) throw new HttpError(403, 'Accès refusé')

  const userResult = await pool.query(
    'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  )
  const userRow = userResult.rows[0]
  if (!userRow || !userRow.is_active) throw new HttpError(401, 'Compte introuvable ou désactivé')

  const { rows } = await pool.query(
    'SELECT id, match_id, storage_key, status FROM video_clips WHERE id = $1',
    [clipId]
  )
  if (!rows[0]) throw new HttpError(404, 'Clip introuvable')
  let allowed = false
  try {
    await getMatch(toPublicUser(userRow), rows[0].match_id) // accès complet au match
    allowed = true
  } catch (err) {
    if (!(err instanceof HttpError)) throw err
  }
  if (!allowed) {
    // Sinon : le clip doit être joint à un rapport actuellement partagé avec cette personne.
    const shared = await pool.query(
      `SELECT 1 FROM report_links l
       JOIN analysis_reports r ON r.id = l.report_id
       JOIN report_shares s ON s.report_id = r.id
       WHERE l.clip_id = $1 AND r.status = 'partage' AND s.user_id = $2 LIMIT 1`,
      [clipId, userRow.id]
    )
    if (shared.rowCount === 0) throw new HttpError(403, 'Accès refusé')
  }
  if (rows[0].status !== 'pret' || !rows[0].storage_key) throw new HttpError(409, "Le fichier du clip n'est pas prêt")
  return rows[0]
}
