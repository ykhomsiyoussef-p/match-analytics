import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { userIdParamSchema, createUserSchema, updateUserSchema } from '../validation/user.schemas.js'
import * as userController from '../controllers/user.controller.js'

// Monté sur /api/users (authentification faite avant).
const router = Router()

router.get('/recipients', requireRole('admin', 'analyste'), userController.recipients)
router.get('/', requireRole('admin'), userController.list)
router.post('/', requireRole('admin'), validate(createUserSchema), userController.create)
router.patch('/:id', requireRole('admin'), validate(userIdParamSchema, 'params'), validate(updateUserSchema), userController.update)

export default router
