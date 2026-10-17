import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import * as videoService from '../services/video.service.js'
import * as eventService from '../services/event.service.js'
import { streamFile } from '../video/streamFile.js'

export const list = asyncHandler(async (req, res) => {
  res.json({ videos: await videoService.listVideos(req.user, req.params.id) })
})

export const createUpload = asyncHandler(async (req, res) => {
  const video = await videoService.createUpload(req.user, req.params.id, req.body, req.ip)
  res.status(201).json({ video })
})

export const status = asyncHandler(async (req, res) => {
  res.json({ video: await videoService.getVideo(req.user, req.params.id, req.params.videoId) })
})

export const chunk = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body)) {
    throw new HttpError(415, 'Corps attendu : application/octet-stream')
  }
  const { videoId, id } = req.params
  res.json(await videoService.appendChunk(req.user, id, videoId, req.query.offset, req.body))
})

export const complete = asyncHandler(async (req, res) => {
  res.json({ video: await videoService.completeUpload(req.user, req.params.id, req.params.videoId, req.ip) })
})

export const updateSettings = asyncHandler(async (req, res) => {
  res.json({ video: await videoService.updateSettings(req.user, req.params.id, req.params.videoId, req.body) })
})

export const remove = asyncHandler(async (req, res) => {
  await videoService.deleteVideo(req.user, req.params.id, req.params.videoId, req.ip)
  res.status(204).end()
})

export const playback = asyncHandler(async (req, res) => {
  res.json(await videoService.createPlaybackUrl(req.user, req.params.id, req.params.videoId))
})

// Lecture en continu avec prise en charge de « Range » (avance rapide, saut dans la vidéo).
export const stream = asyncHandler(async (req, res) => {
  const video = await videoService.authorizeStream(req.query.token, req.params.videoId)
  streamFile(req, res, {
    storageKey: video.storage_key,
    mimeType: video.mime_type,
    total: Number(video.size_bytes),
  })
})

export const events = asyncHandler(async (req, res) => {
  res.json({ events: await eventService.listVideoEvents(req.user, req.params.id, req.params.videoId) })
})
