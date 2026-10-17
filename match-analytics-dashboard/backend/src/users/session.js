// Un jeton émis AVANT le dernier changement de mot de passe n'est plus valable :
// changer (ou réinitialiser) un mot de passe déconnecte toutes les autres sessions.
// iat : date d'émission du jeton, en secondes ; changedAt : date du changement (Date ou texte).
export function isTokenStale(iat, changedAt) {
  if (typeof iat !== 'number' || !changedAt) return false
  return iat < Math.floor(new Date(changedAt).getTime() / 1000)
}
