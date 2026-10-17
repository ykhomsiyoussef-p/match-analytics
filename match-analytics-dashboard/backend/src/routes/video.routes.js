import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { idParamSchema } from '../validation/match.schemas.js'
import {
  videoParamsSchema,
  createUploadSchema,
  chunkQuerySchema,
  videoSettingsSchema,
} from '../validation/video.schemas.js'
import * as videoController from '../controllers/video.controller.js'
import annotationRoutes from './annotation.routes.js'
import clipRoutes from './clip.routes.js'

// Monté sur /api/matches/:id/videos (l'authentification est faite avant).
const router = Router({ mergeParams: true })

router.get('/', validate(idParamSchema, 'params'), videoController.list)
router.post(
  '/',
  requireRole('admin', 'analyste'),
  validate(idParamSchema, 'params'),
  validate(createUploadSchema),
  videoController.createUpload
)

router.use('/:videoId/annotations', annotationRoutes)
router.use('/:videoId/clips', clipRoutes)
router.get('/:videoId/events', validate(videoParamsSchema, 'params'), videoController.events)

router.get('/:videoId', validate(videoParamsSchema, 'params'), videoController.status)
router.get('/:videoId/playback', validate(videoParamsSchema, 'params'), videoController.playback)
router.put(
  '/:videoId/chunks',
  requireRole('admin', 'analyste'),
  validate(videoParamsSchema, 'params'),
  validate(chunkQuerySchema, 'query'),
  videoController.chunk
)
router.post(
  '/:videoId/complete',
  requireRole('admin', 'analyste'),
  validate(videoParamsSchema, 'params'),
  videoController.complete
)
router.patch(
  '/:videoId',
  requireRole('admin', 'analyste'),
  validate(videoParamsSchema, 'params'),
  validate(videoSettingsSchema),
  videoController.updateSettings
)
router.delete(
  '/:videoId',
  requireRole('admin', 'analyste'),
  validate(videoParamsSchema, 'params'),
  videoController.remove
)

export default router
