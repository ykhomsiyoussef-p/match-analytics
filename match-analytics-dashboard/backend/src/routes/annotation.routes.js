import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { videoParamsSchema, annotationParamsSchema, annotationSchema } from '../validation/video.schemas.js'
import * as annotationController from '../controllers/annotation.controller.js'

// Monté sur /api/matches/:id/videos/:videoId/annotations
const router = Router({ mergeParams: true })

router.get('/', validate(videoParamsSchema, 'params'), annotationController.list)
router.post(
  '/',
  requireRole('admin', 'analyste'),
  validate(videoParamsSchema, 'params'),
  validate(annotationSchema),
  annotationController.create
)
router.put(
  '/:annotationId',
  requireRole('admin', 'analyste'),
  validate(annotationParamsSchema, 'params'),
  validate(annotationSchema),
  annotationController.update
)
router.delete(
  '/:annotationId',
  requireRole('admin', 'analyste'),
  validate(annotationParamsSchema, 'params'),
  annotationController.remove
)

export default router
