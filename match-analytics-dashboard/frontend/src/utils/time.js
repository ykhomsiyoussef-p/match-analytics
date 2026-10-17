// Affiche des secondes en « m:ss » ou « h:mm:ss » (avec dixièmes si demandé).
export function formatClock(seconds, withTenths = false) {
  const value = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const tenths = Math.floor(value * 10)
  const total = Math.floor(tenths / 10)
  const t = tenths % 10
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0') + (withTenths ? `.${t}` : '')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

// Lit « 12:35 », « 1:02:03.5 » ou « 755 » et retourne des secondes (NaN si invalide).
export function parseClock(text) {
  const t = String(text ?? '').trim().replace(',', '.')
  if (t === '') return NaN
  const parts = t.split(':')
  if (parts.length > 3) return NaN
  const nums = parts.map((p) => (/^\d+(\.\d+)?$/.test(p) ? Number(p) : NaN))
  if (nums.some(Number.isNaN)) return NaN
  return nums.reduce((acc, n) => acc * 60 + n, 0)
}

// Minute de jeu approximative, à partir des repères « coup d'envoi » et « 2e mi-temps » de la vidéo.
// Retourne null tant que le coup d'envoi n'a pas été défini.
export function matchMinuteAt(t, video) {
  if (!video || !(video.matchStartOffsetSeconds > 0)) return null
  if (video.secondHalfStartSeconds != null && t >= video.secondHalfStartSeconds) {
    return 45 + Math.floor((t - video.secondHalfStartSeconds) / 60) + 1
  }
  if (t < video.matchStartOffsetSeconds) return null
  return Math.floor((t - video.matchStartOffsetSeconds) / 60) + 1
}

export function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} Go`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} Mo`
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`
}
