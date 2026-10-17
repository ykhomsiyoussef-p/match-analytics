import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir backend/.env.example)`)
  }
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  // En production derrière Caddy : HOST=127.0.0.1 (API injoignable depuis Internet) et TRUST_PROXY=1.
  host: process.env.HOST || '',
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // Dossier des vidéos (par défaut backend/storage/videos) et taille maximale d'une vidéo (2 Go).
  videoStorageDir: process.env.VIDEO_STORAGE_DIR
    ? path.resolve(process.env.VIDEO_STORAGE_DIR)
    : fileURLToPath(new URL('../../storage/videos', import.meta.url)),
  maxVideoBytes: Number(process.env.MAX_VIDEO_BYTES) || 2 * 1024 * 1024 * 1024,
  // Découpe des clips : chemin de FFmpeg, durée maximale d'un clip (secondes) et délai maximal de traitement.
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  maxClipSeconds: Number(process.env.MAX_CLIP_SECONDS) || 300,
  clipRenderTimeoutMs: (Number(process.env.CLIP_RENDER_TIMEOUT_MINUTES) || 15) * 60 * 1000,
}

if (env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET doit contenir au moins 32 caractères.')
}

// En production, on refuse de démarrer avec une configuration dangereuse.
if (env.nodeEnv === 'production') {
  const problems = []
  if (!/^https:\/\/[^/]+$/.test(env.corsOrigin)) {
    problems.push("CORS_ORIGIN doit être l'adresse HTTPS du site, par exemple https://exemple.com")
  }
  if (/:postgres@/.test(env.databaseUrl) || /:match_dev_password@/.test(env.databaseUrl)) {
    problems.push('DATABASE_URL utilise un mot de passe par défaut : choisissez-en un autre')
  }
  if (problems.length > 0) {
    throw new Error(`Configuration de production refusée :\n- ${problems.join('\n- ')}`)
  }
}
