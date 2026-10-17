import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string({ required_error: 'Champ requis' }).trim().email('Adresse e-mail invalide').max(254),
  password: z.string({ required_error: 'Champ requis' }).min(1, 'Champ requis').max(200),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Champ requis' }).min(1, 'Champ requis').max(200),
  newPassword: z.string({ required_error: 'Champ requis' }).min(10, '10 caractères minimum').max(200),
})
