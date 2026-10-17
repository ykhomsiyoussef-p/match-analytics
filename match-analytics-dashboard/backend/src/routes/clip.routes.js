import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { videoParamsSchema, clipParamsSchema, clipSchema } from '../validation/video.schemas.js'
import * as clipController from '../controllers/clip.controller.js'

// Monté sur /api/matches/:id/videos/:videoId/clips
const router = Router({ mergeParams: true })

router.get('/', validate(videoParamsSchema, 'params'), clipController.list)
router.post('/', requireRole('admin', 'analyste'), validate(videoParamsSchema, 'params'), validate(clipSchema), clipController.create)
router.put('/:clipId', requireRole('admin', 'analyste'), validate(clipParamsSchema, 'params'), validate(clipSchema), clipController.update)
router.delete('/:clipId', requireRole('admin', 'analyste'), validate(clipParamsSchema, 'params'), clipController.remove)
router.post('/:clipId/render', requireRole('admin', 'analyste'), validate(clipParamsSchema, 'params'), clipController.render)
router.get('/:clipId/playback', validate(clipParamsSchema, 'params'), clipController.playback)

export default router
