// Politique de mot de passe : 10 caractères minimum, ni trivial, ni lié à l'adresse e-mail.
const COMMON = new Set([
  'password', 'password1', 'motdepasse', 'azertyuiop', 'qwertyuiop', '1234567890', '0123456789',
  'abcdefghij', 'iloveyou12', 'football123', 'footballer', 'matchanalytics',
])

// Retourne un message d'erreur, ou null si le mot de passe est acceptable.
export function checkPassword(password, email = '') {
  if (typeof password !== 'string' || password.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères.'
  if (password.length > 200) return 'Le mot de passe est trop long.'
  const lower = password.toLowerCase()
  if (new Set(lower).size < 4) return 'Le mot de passe est trop répétitif.'
  if (COMMON.has(lower)) return 'Ce mot de passe est trop courant.'
  const local = String(email).split('@')[0].toLowerCase()
  if (local.length >= 4 && lower.includes(local)) return "Le mot de passe ne doit pas contenir votre adresse e-mail."
  return null
}
