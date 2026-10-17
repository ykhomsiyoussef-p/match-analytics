import app from './app.js'
import { env } from './config/env.js'
import { pool } from './db/pool.js'
import { recoverInterruptedClips } from './services/clip.service.js'

pool.query('SELECT 1').catch((err) => {
  console.error('Connexion à PostgreSQL impossible :', err.message)
  console.error('Vérifiez que PostgreSQL est démarré et que DATABASE_URL est correct dans backend/.env')
})

recoverInterruptedClips().catch((err) => console.error('Récupération des clips impossible :', err.message))

const onListening = () => {
  console.log(`API démarrée sur http://${env.host || 'localhost'}:${env.port}`)
}
const server = env.host ? app.listen(env.port, env.host, onListening) : app.listen(env.port, onListening)

async function shutdown() {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
