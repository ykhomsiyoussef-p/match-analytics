// Temps vidéo d'un événement.
// 1. Si le CSV fournissait un temps vidéo, on l'utilise.
// 2. Sinon on l'estime à partir de la minute de jeu et des repères de la vidéo
//    (instant du coup d'envoi, instant du début de la 2e mi-temps).
// Retourne { seconds, source } où source vaut 'csv', 'estimated' ou null (impossible à situer).
export function estimateVideoTime(event, video) {
  if (event.videoTimeSeconds !== null && event.videoTimeSeconds !== undefined) {
    return { seconds: event.videoTimeSeconds, source: 'csv' }
  }
  const start = video.matchStartOffsetSeconds
  if (!(start > 0)) return { seconds: null, source: null }

  const elapsed = event.minute * 60 + event.second // temps de jeu écoulé depuis le coup d'envoi
  if (event.period === 1) {
    return { seconds: start + elapsed, source: 'estimated' }
  }
  if (event.period === 2 && video.secondHalfStartSeconds !== null && video.secondHalfStartSeconds !== undefined) {
    const sinceHalfTime = elapsed - 45 * 60
    if (sinceHalfTime >= 0) return { seconds: video.secondHalfStartSeconds + sinceHalfTime, source: 'estimated' }
  }
  return { seconds: null, source: null } // prolongations ou repère manquant
}
