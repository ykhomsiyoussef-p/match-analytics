import { readFileSync } from 'node:fs'
import { pool } from './pool.js'

const reset = process.argv.includes('--reset')

if (reset && process.env.NODE_ENV === 'production') {
  console.error('La réinitialisation est interdite en production.')
  process.exit(1)
}

try {
  if (reset) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    console.log('Schéma réinitialisé (toutes les données ont été supprimées).')
  }
  const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  await pool.query(sql)
  console.log('Schéma appliqué avec succès.')
} catch (err) {
  console.error('Échec de la migration :', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
