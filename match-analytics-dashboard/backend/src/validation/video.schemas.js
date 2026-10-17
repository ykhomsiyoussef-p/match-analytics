import { z } from 'zod'

const id = z.coerce.number({ invalid_type_error: 'Identifiant invalide' }).int().positive('Identifiant invalide')

export const videoParamsSchema = z.object({ id, videoId: id })
export const videoOnlyParamsSchema = z.object({ videoId: id })
export const annotationParamsSchema = z.object({ id, videoId: id, annotationId: id })

export const createUploadSchema = z.object({
  fileName: z.string({ required_error: 'Nom de fichier manquant' }).trim().min(1).max(255),
  mimeType: z.enum(['video/mp4', 'video/webm', 'video/quicktime'], {
    errorMap: () => ({ message: 'Format non pris en charge (MP4, MOV ou WebM)' }),
  }),
  sizeBytes: z.coerce.number({ invalid_type_error: 'Taille invalide' }).int().positive('Taille invalide'),
})

export const chunkQuerySchema = z.object({
  offset: z.coerce.number({ invalid_type_error: 'Décalage invalide' }).int().min(0, 'Décalage invalide'),
})

const seconds = z.coerce
  .number({ invalid_type_error: 'Nombre attendu' })
  .min(0, 'Doit être positif')
  .max(172800, 'Valeur trop grande')

export const videoSettingsSchema = z.object({
  matchStartOffsetSeconds: seconds.optional(),
  secondHalfStartSeconds: seconds.nullish(),
})

export const ANNOTATION_CATEGORIES = [
  'but', 'tir', 'passe_cle', 'organisation_offensive', 'organisation_defensive',
  'transition_offensive', 'transition_defensive', 'coup_de_pied_arrete',
  'erreur_individuelle', 'point_fort', 'point_a_ameliorer', 'commentaire_libre',
]

export const annotationSchema = z
  .object({
    teamId: id,
    playerId: id.nullish(),
    category: z.enum(ANNOTATION_CATEGORIES, { errorMap: () => ({ message: 'Catégorie invalide' }) }),
    title: z
      .string({ required_error: 'Champ requis' })
      .trim()
      .min(1, 'Champ requis')
      .max(150, '150 caractères maximum'),
    description: z.string().trim().max(2000, '2000 caractères maximum').nullish(),
    startTimeSeconds: seconds,
    endTimeSeconds: seconds.nullish(),
  })
  .refine((d) => d.endTimeSeconds == null || d.endTimeSeconds >= d.startTimeSeconds, {
    message: 'La fin doit être après le début',
    path: ['endTimeSeconds'],
  })

export const clipParamsSchema = z.object({ id, videoId: id, clipId: id })
export const clipOnlyParamsSchema = z.object({ clipId: id })

export const clipSchema = z
  .object({
    title: z
      .string({ required_error: 'Champ requis' })
      .trim()
      .min(1, 'Champ requis')
      .max(150, '150 caractères maximum'),
    description: z.string().trim().max(2000, '2000 caractères maximum').nullish(),
    category: z.enum(ANNOTATION_CATEGORIES, { errorMap: () => ({ message: 'Catégorie invalide' }) }),
    startTimeSeconds: seconds,
    endTimeSeconds: seconds,
    annotationId: id.nullish(),
    playerIds: z.array(id).max(30, '30 joueurs maximum').default([]),
  })
  .refine((d) => d.endTimeSeconds > d.startTimeSeconds, {
    message: 'La fin doit être après le début',
    path: ['endTimeSeconds'],
  })
