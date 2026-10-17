import { z } from 'zod'

const id = z.coerce.number({ invalid_type_error: 'Identifiant invalide' }).int().positive('Identifiant invalide')

export const reportParamsSchema = z.object({ id })
export const reportClipParamsSchema = z.object({ id, clipId: id })
export const reportListQuerySchema = z.object({ matchId: id.optional() })

export const createReportSchema = z.object({ matchId: id })

export const LINK_SECTIONS = [
  'resume', 'points_forts', 'faiblesses', 'problemes_tactiques', 'performances_individuelles', 'recommandations',
]

const text = z.string().trim().max(10000, '10 000 caractères maximum').nullish()

const linkSchema = z
  .object({
    section: z.enum(LINK_SECTIONS, { errorMap: () => ({ message: 'Section invalide' }) }),
    annotationId: id.nullish(),
    clipId: id.nullish(),
  })
  .refine((l) => Boolean(l.annotationId) !== Boolean(l.clipId), {
    message: 'Un lien doit désigner une annotation OU un clip',
  })

export const reportUpdateSchema = z.object({
  summary: text,
  strengths: text,
  weaknesses: text,
  tacticalIssues: text,
  individualPerformances: text,
  recommendations: text,
  links: z.array(linkSchema).max(200, '200 éléments liés maximum').default([]),
})

export const transitionSchema = z.object({
  action: z.enum(['submit', 'validate', 'reject', 'share', 'unshare', 'reopen'], {
    errorMap: () => ({ message: 'Action inconnue' }),
  }),
})

export const sharesSchema = z.object({
  shares: z
    .array(z.object({ userId: id, canComment: z.boolean().default(false) }))
    .max(100, '100 destinataires maximum'),
})

export const commentSchema = z.object({
  body: z.string({ required_error: 'Commentaire vide' }).trim().min(1, 'Commentaire vide').max(2000, '2000 caractères maximum'),
})
