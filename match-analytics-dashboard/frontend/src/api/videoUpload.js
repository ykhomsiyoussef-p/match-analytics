import { api, tokenStore, ApiError } from './client.js'

export const CHUNK_SIZE = 4 * 1024 * 1024 // 4 Mo par morceau
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024 // 2 Go (le serveur applique sa propre limite)

const MIME_BY_EXTENSION = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }

export function detectMime(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  return MIME_BY_EXTENSION[ext] ?? null
}

async function putChunk(matchId, videoId, offset, blob, signal) {
  const response = await fetch(`/api/matches/${matchId}/videos/${videoId}/chunks?offset=${offset}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      Authorization: `Bearer ${tokenStore.get()}`,
    },
    body: blob,
    signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error || "Échec de l'envoi", response.status, data?.details)
  return data
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Envoie le fichier morceau par morceau à partir de `startAt` (reprise possible).
// En cas de coupure réseau, chaque morceau est réessayé 3 fois avant d'abandonner.
export async function uploadVideoFile({ matchId, videoId, file, startAt = 0, onProgress, signal }) {
  let offset = startAt
  while (offset < file.size) {
    const blob = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size))
    let attempt = 0
    for (;;) {
      try {
        const { uploadedBytes } = await putChunk(matchId, videoId, offset, blob, signal)
        offset = uploadedBytes
        break
      } catch (err) {
        if (err.name === 'AbortError') throw err
        // Le serveur indique où il en est : on se resynchronise.
        if (err.status === 409 && err.details && err.details.uploadedBytes !== undefined) {
          offset = err.details.uploadedBytes
          break
        }
        // Erreur définitive (fichier refusé, droits...) : inutile de réessayer.
        if (err.status && err.status < 500) throw err
        attempt += 1
        if (attempt >= 3) throw err
        await wait(1000 * attempt)
      }
    }
    if (onProgress) onProgress(offset, file.size)
  }
  await api.post(`/matches/${matchId}/videos/${videoId}/complete`)
}
