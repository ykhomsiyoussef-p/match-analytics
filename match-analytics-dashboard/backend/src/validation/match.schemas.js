import { z } from 'zod'

const text = (max) =>
  z
    .string({ required_error: 'Champ requis', invalid_type_error: 'Texte attendu' })
    .trim()
    .min(1, 'Champ requis')
    .max(max, `${max} caractères maximum`)

const score = z.coerce
  .number({ invalid_type_error: 'Nombre attendu' })
  .int('Nombre entier attendu')
  .min(0, 'Le score ne peut pas être négatif')
  .max(99, '99 maximum')
  .default(0)

export const createMatchSchema = z
  .object({
    homeTeamName: text(100),
    awayTeamName: text(100),
    matchDate: z
      .string({ required_error: 'Champ requis' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ')
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Date invalide'),
    competition: z.string().trim().max(150, '150 caractères maximum').optional(),
    homeScore: score,
    awayScore: score,
    analysisType: z
      .enum(['globale', 'offensive', 'defensive', 'coups_arretes', 'individuelle'], {
        errorMap: () => ({ message: "Type d'analyse invalide" }),
      })
      .default('globale'),
  })
  .refine((d) => d.homeTeamName.toLowerCase() !== d.awayTeamName.toLowerCase(), {
    message: 'Les deux équipes doivent être différentes',
    path: ['awayTeamName'],
  })

export const idParamSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'Identifiant invalide' }).int().positive('Identifiant invalide'),
})
