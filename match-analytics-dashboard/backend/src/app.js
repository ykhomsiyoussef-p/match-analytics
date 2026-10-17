import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import routes from './routes/index.js'
import { requireAuth } from './middleware/auth.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'

const app = express()

app.disable('x-powered-by')
// Derrière un proxy (Caddy), l'adresse IP réelle du visiteur vient de X-Forwarded-For.
if (env.trustProxy) app.set('trust proxy', env.trustProxy)
app.use(helmet())
app.use(cors({ origin: env.corsOrigin }))

// Les imports CSV envoient le fichier dans le corps JSON : limite plus large,
// mais seulement pour les utilisateurs connectés.
app.use('/api/matches/:id/imports', requireAuth, express.json({ limit: '10mb' }))
// Les vidéos sont envoyées par morceaux (octets bruts), seulement pour les utilisateurs connectés.
app.use(
  '/api/matches/:id/videos/:videoId/chunks',
  requireAuth,
  express.raw({ type: 'application/octet-stream', limit: '6mb' })
)
app.use(express.json({ limit: '1mb' }))

// Limite générale par adresse IP (la lecture vidéo et l'envoi par morceaux en sont exclus : très nombreux par nature).
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 3000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.endsWith('/stream') || req.path.endsWith('/chunks'),
    message: { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
  })
)

app.use('/api', routes)
app.use(notFound)
app.use(errorHandler)

export default app
