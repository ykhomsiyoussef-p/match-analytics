import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'
import { HttpError } from '../utils/httpError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { toPublicUser } from '../services/auth.service.js'
import { isTokenStale } from '../users/session.js'

// Vérifie le jeton, puis recharge l'utilisateur depuis la base :
// un compte désactivé ou un rôle modifié est pris en compte immédiatement.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Authentification requise')
  }

  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
  } catch {
    throw new HttpError(401, 'Session expirée ou invalide')
  }

  // Les jetons à usage limité (lecture vidéo) ne donnent pas accès à l'API.
  if (payload.purpose) {
    throw new HttpError(401, 'Session expirée ou invalide')
  }

  const { rows } = await query(
    'SELECT id, email, full_name, role, is_active, password_changed_at FROM users WHERE id = $1',
    [payload.sub]
  )
  const user = rows[0]
  if (!user || !user.is_active) {
    throw new HttpError(401, 'Compte introuvable ou désactivé')
  }

  if (isTokenStale(payload.iat, user.password_changed_at)) {
    throw new HttpError(401, 'Session expirée : le mot de passe a été modifié')
  }

  req.user = toPublicUser(user)
  next()
})

// Contrôle du rôle côté serveur.
export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'Accès refusé'))
