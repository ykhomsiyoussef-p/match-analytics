// Analyse de l'en-tête HTTP « Range » (lecture partielle, nécessaire pour avancer dans une vidéo).
// Retourne { start, end } (inclus), ou null si l'en-tête est invalide ou hors du fichier.
export function parseRange(header, total) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '')
  if (!m || (m[1] === '' && m[2] === '')) return null

  let start
  let end
  if (m[1] === '') {
    const suffix = Number(m[2]) // « les N derniers octets »
    if (suffix === 0) return null
    start = Math.max(0, total - suffix)
    end = total - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1)
  }
  if (start >= total || start > end) return null
  return { start, end }
}
