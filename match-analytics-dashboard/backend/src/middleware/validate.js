import { HttpError } from '../utils/httpError.js'

// Valide req[source] (body, params ou query) avec un schéma zod.
export const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      return next(new HttpError(400, 'Données invalides', details))
    }
    req[source] = result.data
    next()
  }
