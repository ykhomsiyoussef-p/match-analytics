import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { loginSchema, changePasswordSchema } from '../validation/auth.schemas.js'
import * as authController from '../controllers/auth.controller.js'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
})

const router = Router()
router.post('/login', loginLimiter, validate(loginSchema), authController.login)
router.get('/me', requireAuth, authController.me)
router.post('/change-password', requireAuth, validate(changePasswordSchema), authController.changePassword)

export default router
