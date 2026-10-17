import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createMatchSchema, idParamSchema } from '../validation/match.schemas.js'
import * as matchController from '../controllers/match.controller.js'
import importRoutes from './import.routes.js'
import videoRoutes from './video.routes.js'

const router = Router()
router.use(requireAuth)

router.get('/', matchController.listMatches)
router.post('/', requireRole('admin', 'analyste'), validate(createMatchSchema), matchController.createMatch)
router.get('/:id', validate(idParamSchema, 'params'), matchController.getMatch)
router.get('/:id/dashboard', validate(idParamSchema, 'params'), matchController.getMatchDashboard)
router.get('/:id/dataset', validate(idParamSchema, 'params'), matchController.getMatchDataset)
router.get('/:id/roster', validate(idParamSchema, 'params'), matchController.getRoster)
router.use('/:id/imports', importRoutes)
router.use('/:id/videos', videoRoutes)

export default router
