import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  reportParamsSchema, reportClipParamsSchema, reportListQuerySchema, createReportSchema,
  reportUpdateSchema, transitionSchema, sharesSchema, commentSchema,
} from '../validation/report.schemas.js'
import * as c from '../controllers/report.controller.js'

// Monté sur /api/reports (authentification faite avant). Les droits fins sont décidés par le service.
const router = Router()
const writers = requireRole('admin', 'analyste')

router.get('/', validate(reportListQuerySchema, 'query'), c.list)
router.post('/', writers, validate(createReportSchema), c.create)
router.get('/:id', validate(reportParamsSchema, 'params'), c.get)
router.put('/:id', writers, validate(reportParamsSchema, 'params'), validate(reportUpdateSchema), c.update)
router.post('/:id/transition', writers, validate(reportParamsSchema, 'params'), validate(transitionSchema), c.transition)
router.put('/:id/shares', writers, validate(reportParamsSchema, 'params'), validate(sharesSchema), c.shares)
router.post('/:id/comments', validate(reportParamsSchema, 'params'), validate(commentSchema), c.comment)
router.get('/:id/attachables', writers, validate(reportParamsSchema, 'params'), c.attachables)
router.get('/:id/clips/:clipId/playback', validate(reportClipParamsSchema, 'params'), c.clipPlayback)
router.get('/:id/pdf', validate(reportParamsSchema, 'params'), c.pdf)

export default router
