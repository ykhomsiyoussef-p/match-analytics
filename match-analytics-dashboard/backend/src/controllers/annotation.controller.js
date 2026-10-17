import { asyncHandler } from '../utils/asyncHandler.js'
import * as annotationService from '../services/annotation.service.js'

export const list = asyncHandler(async (req, res) => {
  const { id, videoId } = req.params
  res.json({ annotations: await annotationService.listAnnotations(req.user, id, videoId) })
})

export const create = asyncHandler(async (req, res) => {
  const { id, videoId } = req.params
  const annotation = await annotationService.createAnnotation(req.user, id, videoId, req.body)
  res.status(201).json({ annotation })
})

export const update = asyncHandler(async (req, res) => {
  const { id, videoId, annotationId } = req.params
  res.json({ annotation: await annotationService.updateAnnotation(req.user, id, videoId, annotationId, req.body) })
})

export const remove = asyncHandler(async (req, res) => {
  const { id, videoId, annotationId } = req.params
  await annotationService.deleteAnnotation(req.user, id, videoId, annotationId)
  res.status(204).end()
})
