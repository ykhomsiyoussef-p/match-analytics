import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import * as clipService from '../services/clip.service.js'
import * as storage from '../storage/local.js'
import { streamFile } from '../video/streamFile.js'

export const list = asyncHandler(async (req, res) => {
  const { id, videoId } = req.params
  res.json({ clips: await clipService.listClips(req.user, id, videoId) })
})

export const create = asyncHandler(async (req, res) => {
  const { id, videoId } = req.params
  res.status(201).json({ clip: await clipService.createClip(req.user, id, videoId, req.body) })
})

export const update = asyncHandler(async (req, res) => {
  const { id, videoId, clipId } = req.params
  res.json({ clip: await clipService.updateClip(req.user, id, videoId, clipId, req.body) })
})

export const remove = asyncHandler(async (req, res) => {
  const { id, videoId, clipId } = req.params
  await clipService.deleteClip(req.user, id, videoId, clipId)
  res.status(204).end()
})

export const render = asyncHandler(async (req, res) => {
  const { id, videoId, clipId } = req.params
  res.status(202).json({ clip: await clipService.startRender(req.user, id, videoId, clipId) })
})

export const playback = asyncHandler(async (req, res) => {
  const { id, videoId, clipId } = req.params
  res.json(await clipService.createClipPlaybackUrl(req.user, id, videoId, clipId))
})

// Lecture ou téléchargement (?download=1) du fichier généré.
export const stream = asyncHandler(async (req, res) => {
  const clip = await clipService.authorizeClipStream(req.query.token, req.params.clipId)
  const total = await storage.size(clip.storage_key)
  if (total === 0) throw new HttpError(404, 'Fichier du clip introuvable')
  streamFile(req, res, {
    storageKey: clip.storage_key,
    mimeType: 'video/mp4',
    total,
    downloadName: req.query.download === '1' ? `clip-${clip.id}.mp4` : null,
  })
})
