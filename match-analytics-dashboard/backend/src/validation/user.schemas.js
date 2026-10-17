import { z } from 'zod'

const ROLES = ['admin', 'analyste', 'entraineur']
const role = z.enum(ROLES, { errorMap: () => ({ message: 'Rôle invalide' }) })
const password = z.string({ required_error: 'Champ requis' }).min(10, '10 caractères minimum').max(200)

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Identifiant invalide'),
})

export const createUserSchema = z.object({
  email: z.string({ required_error: 'Champ requis' }).trim().email('Adresse e-mail invalide').max(254),
  fullName: z.string({ required_error: 'Champ requis' }).trim().min(1, 'Champ requis').max(100),
  role,
  password,
})

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Champ requis').max(100).optional(),
    role: role.optional(),
    isActive: z.boolean().optional(),
    password: password.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification demandée' })
