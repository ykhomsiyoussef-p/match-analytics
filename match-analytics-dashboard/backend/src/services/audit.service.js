import { pool } from '../db/pool.js'

// Journalise une opération sensible. `client` : client de transaction facultatif.
export async function logAudit({ client, userId = null, action, entityType = null, entityId = null, details = {}, ip = null }) {
  const executor = client || pool
  try {
    await executor.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, JSON.stringify(details), ip]
    )
  } catch (err) {
    if (client) throw err // dans une transaction, on laisse annuler l'ensemble
    console.error("Échec de l'écriture du journal d'audit :", err.message)
  }
}
