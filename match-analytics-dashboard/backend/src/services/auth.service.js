import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../db/pool.js'
import { HttpError } from '../utils/httpError.js'
import { logAudit } from './audit.service.js'

// Hash factice : on compare toujours un mot de passe, même si l'e-mail n'existe pas,
// pour ne pas révéler par le temps de réponse quels comptes existent.
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', 12)

export const toPublicUser = (row) => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  role: row.role,
})

export function issueToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: String(user.id),
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  })
}

export async function login(email, password, ip) {
  const { rows } = await query(
    `SELECT id, email, full_name, role, password_hash, is_active
     FROM users WHERE lower(email) = lower($1)`,
    [email]
  )
  const user = rows[0]
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)

  if (!user || !user.is_active || !passwordOk) {
    await logAudit({ action: 'login_failed', details: { email }, ip })
    throw new HttpError(401, 'Adresse e-mail ou mot de passe incorrect')
  }

  const token = issueToken(user)
  await logAudit({ userId: user.id, action: 'login', ip })
  return { token, user: toPublicUser(user) }
}
