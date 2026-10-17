import pg from 'pg'
import { env } from '../config/env.js'

export const pool = new pg.Pool({ connectionString: env.databaseUrl })

export const query = (text, params) => pool.query(text, params)

// Exécute fn(client) dans une transaction : tout est annulé si une erreur survient.
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
