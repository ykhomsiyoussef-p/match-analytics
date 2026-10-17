import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { idParamSchema } from '../validation/match.schemas.js'
import {
  previewSchema,
  analyzeSchema,
  commitSchema,
  importParamsSchema,
} from '../validation/import.schemas.js'
import * as importController from '../controllers/import.controller.js'

// Monté sur /api/matches/:id/imports (l'authentification est faite avant).
const router = Router({ mergeParams: true })

router.use(requireRole('admin', 'analyste'))

router.get('/', validate(idParamSchema, 'params'), importController.list)
router.post('/preview', validate(idParamSchema, 'params'), validate(previewSchema), importController.preview)
router.post('/validate', validate(idParamSchema, 'params'), validate(analyzeSchema), importController.validate)
router.post('/', validate(idParamSchema, 'params'), validate(commitSchema), importController.commit)
router.delete('/:batchId', validate(importParamsSchema, 'params'), importController.undo)

export default router
