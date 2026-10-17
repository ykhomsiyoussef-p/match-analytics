import path from 'node:path'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool, withTransaction } from '../db/pool.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'
import { getMatchFull as getMatch } from './match.service.js'
import { toPublicUser } from './auth.service.js'
import { logAudit } from './audit.service.js'
import * as storage from '../storage/local.js'
import { matchesSignature } from '../video/signature.js'

const EXT_BY_MIME = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm' }
const ALLOWED_EXTENSIONS = {
  'video/mp4': ['.mp4', '.m4v'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
}
const PLAYBACK_TOKEN_TTL = '4h'

// Envois en cours : un seul morceau à la fois par vidéo.
const activeUploads = new Set()

const VIDEO_SELECT = `
  SELECT v.id, v.match_id, v.storage_key, v.original_filename, v.mime_type, v.size_bytes,
         v.duration_seconds, v.processing_status, v.match_start_offset_seconds,
         v.second_half_start_seconds, v.created_at, v.uploaded_by, u.full_name AS uploaded_by_name
  FROM match_videos v
  JOIN users u ON u.id = v.uploaded_by`

const num = (v) => (v === null || v === undefined ? null : Number(v))

const toVideo = (row, uploadedBytes = null) => ({
  id: row.id,
  matchId: row.match_id,
  fileName: row.original_filename,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  durationSeconds: num(row.duration_seconds),
  status: row.processing_status,
  matchStartOffsetSeconds: Number(row.match_start_offset_seconds),
  secondHalfStartSeconds: num(row.second_half_start_seconds),
  uploadedBytes: uploadedBytes ?? (row.processing_status === 'prete' ? Number(row.size_bytes) : 0),
  uploadedBy: row.uploaded_by_name,
  createdAt: row.created_at,
})

async function getVideoRow(matchId, videoId, db = pool) {
  const { rows } = await db.query(`${VIDEO_SELECT} WHERE v.id = $1 AND v.match_id = $2`, [videoId, matchId])
  if (!rows[0]) throw new HttpError(404, 'Vidéo introuvable')
  return rows[0]
}

// Seul l'administrateur ou la personne qui a envoyé la vidéo peut la modifier.
function assertCanModify(user, row) {
  if (user.role !== 'admin' && row.uploaded_by !== user.id) {
    throw new HttpError(403, 'Accès refusé')
  }
}

export async function listVideos(user, matchId) {
  const match = await getMatch(user, matchId)
  const { rows } = await pool.query(`${VIDEO_SELECT} WHERE v.match_id = $1 ORDER BY v.id DESC`, [match.id])
  return Promise.all(
    rows.map(async (row) =>
      toVideo(row, row.processing_status === 'envoi' ? await storage.size(row.storage_key) : null)
    )
  )
}

export async function getVideo(user, matchId, videoId) {
  const match = await getMatch(user, matchId)
  const row = await getVideoRow(match.id, videoId)
  return toVideo(row, row.processing_status === 'envoi' ? await storage.size(row.storage_key) : null)
}

export async function createUpload(user, matchId, { fileName, mimeType, sizeBytes }, ip) {
  const match = await getMatch(user, matchId)

  if (sizeBytes > env.maxVideoBytes) {
    const gb = (env.maxVideoBytes / 1024 ** 3).toFixed(1)
    throw new HttpError(400, `Vidéo trop volumineuse (${gb} Go maximum)`)
  }
  const ext = path.extname(fileName).toLowerCase()
  if (!ALLOWED_EXTENSIONS[mimeType].includes(ext)) {
    throw new HttpError(400, "L'extension du fichier ne correspond pas à son format")
  }

  const storageKey = `${randomUUID()}${EXT_BY_MIME[mimeType]}`
  const safeName = path.basename(fileName).replace(/[^\p{L}\p{N}._ ()-]/gu, '_').slice(0, 200)

  const { rows } = await pool.query(
    `INSERT INTO match_videos (match_id, storage_key, original_filename, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [match.id, storageKey, safeName, mimeType, sizeBytes, user.id]
  )
  await logAudit({ userId: user.id, action: 'video_upload_started', entityType: 'video', entityId: rows[0].id, details: { matchId: match.id, fileName: safeName, sizeBytes }, ip })

  return toVideo(await getVideoRow(match.id, rows[0].id), 0)
}

export async function appendChunk(user, matchId, videoId, offset, buffer) {
  const match = await getMatch(user, matchId)
  const row = await getVideoRow(match.id, videoId)
  assertCanModify(user, row)

  if (row.processing_status !== 'envoi') throw new HttpError(409, 'Cet envoi est déjà terminé')
  if (buffer.length === 0) throw new HttpError(400, 'Morceau vide')
  if (activeUploads.has(videoId)) throw new HttpError(409, 'Un morceau est déjà en cours de traitement')

  activeUploads.add(videoId)
  try {
    const current = await storage.size(row.storage_key)
    // Le client doit envoyer exactement la suite de ce que le serveur possède déjà.
    if (offset !== current) {
      throw new HttpError(409, 'Décalage inattendu : reprise depuis la position du serveur', { uploadedBytes: current })
    }
    if (current + buffer.length > Number(row.size_bytes)) {
      throw new HttpError(400, 'Le fichier reçu dépasse la taille annoncée')
    }
    await storage.append(row.storage_key, buffer)
    return { uploadedBytes: current + buffer.length }
  } finally {
    activeUploads.delete(videoId)
  }
}

export async function completeUpload(user, matchId, videoId, ip) {
  const match = await getMatch(user, matchId)
  const row = await getVideoRow(match.id, videoId)
  assertCanModify(user, row)
  if (row.processing_status !== 'envoi') throw new HttpError(409, 'Cet envoi est déjà terminé')

  const uploaded = await storage.size(row.storage_key)
  if (uploaded !== Number(row.size_bytes)) {
    throw new HttpError(400, `Envoi incomplet (${uploaded} octets reçus sur ${row.size_bytes})`)
  }

  // Contrôle du contenu : on ne fait pas confiance à l'extension ni au type annoncé.
  const head = await storage.readHead(row.storage_key, 16)
  if (!matchesSignature(head, row.mime_type)) {
    await storage.remove(row.storage_key)
    await pool.query("UPDATE match_videos SET processing_status = 'erreur' WHERE id = $1", [row.id])
    throw new HttpError(400, "Le contenu du fichier ne correspond pas à un fichier vidéo valide")
  }

  await pool.query("UPDATE match_videos SET processing_status = 'prete' WHERE id = $1", [row.id])
  await logAudit({ userId: user.id, action: 'video_uploaded', entityType: 'video', entityId: row.id, details: { matchId: match.id }, ip })
  return toVideo(await getVideoRow(match.id, row.id))
}

// Repères de synchronisation : instant de la vidéo où commencent le match et la 2e mi-temps.
export async function updateSettings(user, matchId, videoId, input) {
  const match = await getMatch(user, matchId)
  const row = await getVideoRow(match.id, videoId)
  assertCanModify(user, row)

  const sets = []
  const params = []
  if (input.matchStartOffsetSeconds !== undefined) {
    params.push(input.matchStartOffsetSeconds)
    sets.push(`match_start_offset_seconds = $${params.length}`)
  }
  if (input.secondHalfStartSeconds !== undefined) {
    params.push(input.secondHalfStartSeconds)
    sets.push(`second_half_start_seconds = $${params.length}`)
  }
  if (sets.length === 0) throw new HttpError(400, 'Aucune modification demandée')

  params.push(row.id)
  await pool.query(`UPDATE match_videos SET ${sets.join(', ')} WHERE id = $${params.length}`, params)
  return toVideo(await getVideoRow(match.id, row.id))
}

export async function deleteVideo(user, matchId, videoId, ip) {
  const match = await getMatch(user, matchId)
  const keys = await withTransaction(async (client) => {
    const row = await getVideoRow(match.id, videoId, client)
    assertCanModify(user, row)
    // Fichiers des clips générés : la base supprime les lignes en cascade, pas les fichiers.
    const clips = await client.query(
      'SELECT storage_key FROM video_clips WHERE video_id = $1 AND storage_key IS NOT NULL',
      [row.id]
    )
    // Les annotations et clips liés sont supprimés en cascade par la base.
    await client.query('DELETE FROM match_videos WHERE id = $1', [row.id])
    await logAudit({ client, userId: user.id, action: 'video_deleted', entityType: 'video', entityId: row.id, details: { matchId: match.id, fileName: row.original_filename }, ip })
    return [row.storage_key, ...clips.rows.map((c) => c.storage_key)]
  })
  for (const key of keys) await storage.remove(key)
}

// Le lecteur <video> ne peut pas envoyer d'en-tête d'authentification :
// on fournit une adresse temporaire, liée à cet utilisateur et à cette vidéo.
export async function createPlaybackUrl(user, matchId, videoId) {
  const match = await getMatch(user, matchId)
  const row = await getVideoRow(match.id, videoId)
  if (row.processing_status !== 'prete') throw new HttpError(409, "Cette vidéo n'est pas encore prête")

  const token = jwt.sign({ purpose: 'video', vid: row.id }, env.jwtSecret, {
    subject: String(user.id),
    expiresIn: PLAYBACK_TOKEN_TTL,
    algorithm: 'HS256',
  })
  return { url: `/api/videos/${row.id}/stream?token=${encodeURIComponent(token)}` }
}

// Appelé à CHAQUE requête de lecture : jeton valide, compte actif, accès au match.
export async function authorizeStream(token, videoId) {
  if (!token || typeof token !== 'string') throw new HttpError(401, 'Authentification requise')

  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
  } catch {
    throw new HttpError(401, 'Lien de lecture expiré ou invalide')
  }
  if (payload.purpose !== 'video' || payload.vid !== videoId) throw new HttpError(403, 'Accès refusé')

  const userResult = await pool.query(
    'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  )
  const userRow = userResult.rows[0]
  if (!userRow || !userRow.is_active) throw new HttpError(401, 'Compte introuvable ou désactivé')

  const { rows } = await pool.query(
    'SELECT id, match_id, storage_key, mime_type, size_bytes, processing_status FROM match_videos WHERE id = $1',
    [videoId]
  )
  if (!rows[0]) throw new HttpError(404, 'Vidéo introuvable')

  await getMatch(toPublicUser(userRow), rows[0].match_id) // lève 404 si le match n'est pas accessible
  if (rows[0].processing_status !== 'prete') throw new HttpError(409, "Cette vidéo n'est pas encore prête")
  return rows[0]
}
