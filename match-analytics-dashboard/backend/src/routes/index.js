import { Router } from 'express'
import { pool } from '../db/pool.js'
import authRoutes from './auth.routes.js'
import matchRoutes from './match.routes.js'
import userRoutes from './user.routes.js'
import reportRoutes from './report.routes.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { videoOnlyParamsSchema, clipOnlyParamsSchema } from '../validation/video.schemas.js'
import * as clipController from '../controllers/clip.controller.js'
import * as videoController from '../controllers/video.controller.js'

const router = Router()

router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'ok' })
  } catch {
    res.status(503).json({ status: 'erreur', database: 'indisponible' })
  }
})

router.use('/auth', authRoutes)
router.get('/videos/:videoId/stream', validate(videoOnlyParamsSchema, 'params'), videoController.stream)
router.get('/clips/:clipId/stream', validate(clipOnlyParamsSchema, 'params'), clipController.stream)
router.use('/matches', matchRoutes)
router.use('/users', requireAuth, userRoutes)
router.use('/reports', requireAuth, reportRoutes)

export default router
