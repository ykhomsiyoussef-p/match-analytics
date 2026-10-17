import bcrypt from 'bcryptjs'
import { pool } from '../db/pool.js'
import { HttpError } from '../utils/httpError.js'
import { checkPassword } from '../users/password.js'
import { logAudit } from './audit.service.js'
import { issueToken } from './auth.service.js'

const toUser = (r) => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  role: r.role,
  isActive: r.is_active,
  createdAt: r.created_at,
})

export async function listUsers() {
  const { rows } = await pool.query(
    'SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY is_active DESC, full_name'
  )
  return rows.map(toUser)
}

// Personnes avec qui on peut partager un rapport : comptes actifs, hors soi-même.
export async function listRecipients(user) {
  const { rows } = await pool.query(
    'SELECT id, email, full_name, role FROM users WHERE is_active AND id <> $1 ORDER BY full_name',
    [user.id]
  )
  return rows.map((r) => ({ id: r.id, email: r.email, fullName: r.full_name, role: r.role }))
}

export async function createUser(admin, input, ip) {
  const problem = checkPassword(input.password, input.email)
  if (problem) throw new HttpError(400, problem)

  const hash = await bcrypt.hash(input.password, 12)
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [input.email, hash, input.fullName, input.role]
    )
    await logAudit({ userId: admin.id, action: 'user_created', entityType: 'user', entityId: rows[0].id, details: { role: input.role }, ip })
    return toUser(rows[0])
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'Un compte existe déjà avec cette adresse e-mail')
    throw err
  }
}

export async function updateUser(admin, id, input, ip) {
  const { rows } = await pool.query('SELECT id, email, role, is_active FROM users WHERE id = $1', [id])
  const target = rows[0]
  if (!target) throw new HttpError(404, 'Utilisateur introuvable')

  const losesAdmin = target.role === 'admin' && target.is_active && (
    (input.role !== undefined && input.role !== 'admin') || input.isActive === false
  )
  if (losesAdmin) {
    // Jamais de compte sans administrateur, et on ne se retire pas soi-même ses droits.
    if (target.id === admin.id) {
      throw new HttpError(400, 'Vous ne pouvez pas retirer vos propres droits d\'administrateur ni désactiver votre compte.')
    }
    const others = await pool.query("SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND is_active AND id <> $1", [id])
    if (others.rows[0].n === 0) throw new HttpError(400, 'Il doit rester au moins un administrateur actif.')
  }

  const sets = []
  const params = []
  const add = (column, value) => {
    params.push(value)
    sets.push(`${column} = $${params.length}`)
  }
  if (input.fullName !== undefined) add('full_name', input.fullName)
  if (input.role !== undefined) add('role', input.role)
  if (input.isActive !== undefined) add('is_active', input.isActive)
  if (input.password !== undefined) {
    const problem = checkPassword(input.password, target.email)
    if (problem) throw new HttpError(400, problem)
    add('password_hash', await bcrypt.hash(input.password, 12))
    add('password_changed_at', new Date())
  }
  params.push(id)
  const updated = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, email, full_name, role, is_active, created_at`,
    params
  )
  await logAudit({
    userId: admin.id,
    action: input.password !== undefined ? 'user_password_reset' : 'user_updated',
    entityType: 'user',
    entityId: id,
    details: { fields: Object.keys(input).filter((k) => k !== 'password') },
    ip,
  })
  return toUser(updated.rows[0])
}

export async function changeOwnPassword(user, { currentPassword, newPassword }, ip) {
  const { rows } = await pool.query('SELECT email, password_hash FROM users WHERE id = $1', [user.id])
  const ok = rows[0] && (await bcrypt.compare(currentPassword, rows[0].password_hash))
  if (!ok) throw new HttpError(400, 'Le mot de passe actuel est incorrect')
  const problem = checkPassword(newPassword, rows[0].email)
  if (problem) throw new HttpError(400, problem)
  if (currentPassword === newPassword) throw new HttpError(400, "Le nouveau mot de passe doit être différent de l'ancien")

  await pool.query('UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3', [
    await bcrypt.hash(newPassword, 12),
    new Date(),
    user.id,
  ])
  await logAudit({ userId: user.id, action: 'password_changed', entityType: 'user', entityId: user.id, ip })
  // Les autres sessions sont déconnectées ; celle-ci reçoit un nouveau jeton pour rester connectée.
  return { token: issueToken(user) }
}
