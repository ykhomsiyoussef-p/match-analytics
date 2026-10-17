// Fonctions de normalisation des valeurs d'un CSV (français et anglais).

// Clé de comparaison : minuscules, sans accents, séparateurs remplacés par « _ ».
export const key = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

// Nombre avec point ou virgule décimale. Retourne NaN si invalide.
export function parseNumber(raw) {
  const t = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN
  return Number(t)
}

// Minute de jeu entière, ou format « 45+2 ».
export function parseMinute(raw) {
  const t = String(raw ?? '').trim()
  const stoppage = t.match(/^(\d{1,3})\s*\+\s*(\d{1,2})$/)
  if (stoppage) return Number(stoppage[1]) + Number(stoppage[2])
  const n = parseNumber(t)
  return Number.isInteger(n) ? n : NaN
}

// Temps vidéo en secondes : « 1395 », « 23:15 » ou « 1:03:20 ».
export function parseVideoTime(raw) {
  const t = String(raw ?? '').trim()
  const parts = t.split(':')
  if (parts.length === 1) return parseNumber(t)
  if (parts.length > 3) return NaN
  const nums = parts.map(parseNumber)
  if (nums.some(Number.isNaN)) return NaN
  return nums.reduce((acc, n) => acc * 60 + n, 0)
}

const TRUE_VALUES = new Set([
  'true', 'vrai', 'oui', 'yes', 'y', 'o', '1', 'reussie', 'reussi',
  'success', 'successful', 'completed', 'complete', 'accurate', 'ok',
])
const FALSE_VALUES = new Set([
  'false', 'faux', 'non', 'no', 'n', '0', 'ratee', 'rate', 'echec',
  'failed', 'fail', 'unsuccessful', 'incomplete', 'inaccurate',
])

// true, false, ou null si la valeur n'est pas reconnue.
export function parseBool(raw) {
  const k = key(raw)
  if (TRUE_VALUES.has(k)) return true
  if (FALSE_VALUES.has(k)) return false
  return null
}

function buildMap(groups) {
  const map = new Map()
  for (const [target, values] of Object.entries(groups)) {
    for (const v of values) map.set(v, target)
  }
  return map
}

// « goal » est un pseudo-type : il devient un tir dont le résultat est « goal ».
const EVENT_TYPES = buildMap({
  shot: ['shot', 'shots', 'tir', 'tirs', 'frappe'],
  goal: ['goal', 'goals', 'but', 'buts'],
  pass: ['pass', 'passes', 'passe'],
  corner: ['corner', 'corners'],
  interception: ['interception', 'interceptions'],
  duel: ['duel', 'duels'],
  tactical: ['tactical', 'tactique', 'evenement_tactique', 'tactical_event'],
  other: ['other', 'autre', 'autres'],
})

const SHOT_OUTCOMES = buildMap({
  goal: ['goal', 'but', 'scored', 'buts', 'but_marque'],
  saved: ['saved', 'arrete', 'arret', 'on_target', 'cadre', 'cadree', 'tir_cadre', 'parade'],
  blocked: ['blocked', 'contre', 'bloque', 'tir_contre'],
  off_target: ['off_target', 'non_cadre', 'hors_cadre', 'wide', 'high', 'off', 'tir_non_cadre', 'hors_cible'],
  post: ['post', 'poteau', 'barre', 'woodwork', 'hit_woodwork', 'barre_transversale'],
})

const DUEL_OUTCOMES = buildMap({
  won: ['won', 'win', 'gagne', 'gagnee', 'success', 'reussi', 'true', 'oui', '1'],
  lost: ['lost', 'loss', 'perdu', 'perdue', 'fail', 'failed', 'echec', 'false', 'non', '0'],
})

const BODY_PARTS = buildMap({
  right_foot: ['right_foot', 'right', 'pied_droit', 'droit', 'pd', 'rf'],
  left_foot: ['left_foot', 'left', 'pied_gauche', 'gauche', 'pg', 'lf'],
  head: ['head', 'header', 'tete', 'de_la_tete'],
  other: ['other', 'autre', 'chest', 'poitrine'],
})

export const normalizeEventType = (raw) => EVENT_TYPES.get(key(raw)) ?? null
export const normalizeShotOutcome = (raw) => SHOT_OUTCOMES.get(key(raw)) ?? null
export const normalizeDuelOutcome = (raw) => DUEL_OUTCOMES.get(key(raw)) ?? null
export const normalizeBodyPart = (raw) => BODY_PARTS.get(key(raw)) ?? null

// Convertit une coordonnée vers un pourcentage du terrain (0 à 100).
export function scaleCoord(value, axis, scale) {
  switch (scale) {
    case 'unit':
      return value * 100
    case 'statsbomb':
      return axis === 'x' ? (value / 120) * 100 : (value / 80) * 100
    case 'meters':
      return axis === 'x' ? (value / 105) * 100 : (value / 68) * 100
    default:
      return value
  }
}
