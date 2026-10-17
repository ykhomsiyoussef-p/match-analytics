import { z } from 'zod'

const csv = z
  .string({ required_error: 'Fichier manquant' })
  .min(1, 'Fichier vide')
  .max(5_000_000, 'Fichier trop volumineux (5 Mo maximum)')

const mapping = z.record(z.string().max(100), z.string().max(300))

const options = z
  .object({
    coordScale: z.enum(['percent', 'unit', 'statsbomb', 'meters']).default('percent'),
    duplicatePolicy: z.enum(['skip_existing', 'import_all']).default('skip_existing'),
  })
  .default({})

export const previewSchema = z.object({ csv })
export const analyzeSchema = z.object({ csv, mapping, options })
export const commitSchema = analyzeSchema.extend({
  fileName: z.string().trim().max(200).optional(),
})

export const importParamsSchema = z.object({
  id: z.coerce.number().int().positive('Identifiant invalide'),
  batchId: z.coerce.number().int().positive('Identifiant invalide'),
})
