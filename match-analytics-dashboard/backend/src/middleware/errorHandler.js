import { HttpError } from '../utils/httpError.js'

export function notFound(req, res) {
  res.status(404).json({ error: 'Route introuvable' })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide' })
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Cette valeur existe déjà' })
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Opération impossible : des données liées existent' })
  }
  if (['22007', '22008', '22P02', '23514'].includes(err.code)) {
    return res.status(400).json({ error: 'Données invalides' })
  }
  console.error(err)
  res.status(500).json({ error: 'Erreur interne du serveur' })
}
