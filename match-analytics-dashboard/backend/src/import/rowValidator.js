import {
  key,
  parseNumber,
  parseMinute,
  parseVideoTime,
  parseBool,
  normalizeEventType,
  normalizeShotOutcome,
  normalizeDuelOutcome,
  normalizeBodyPart,
  scaleCoord,
} from './normalizers.js'

const round2 = (n) => Math.round(n * 100) / 100

const SIDE_ALIASES = new Map([
  ['home', 'home'], ['domicile', 'home'], ['dom', 'home'], ['local', 'home'], ['h', 'home'],
  ['away', 'away'], ['exterieur', 'away'], ['ext', 'away'], ['visiteur', 'away'], ['a', 'away'],
])

// Valide et convertit chaque ligne. Aucune donnée n'est inventée :
// une ligne invalide est rejetée avec la liste de ses problèmes.
export function validateRows({ parsed, mapping, options, home, away }) {
  const { headers, rows } = parsed
  const colOf = new Map(headers.map((h, i) => [h, i]))

  const idx = {}
  for (const [field, header] of Object.entries(mapping)) {
    if (header && colOf.has(header)) idx[field] = colOf.get(header)
  }
  const mappedCols = new Set(Object.values(idx))
  const extraCols = headers
    .map((h, i) => [h, i])
    .filter(([, i]) => !mappedCols.has(i))
    .slice(0, 30)

  const teamLookup = new Map([
    [key(home.name), 'home'],
    [key(away.name), 'away'],
  ])

  const records = []
  const errors = []
  const warnings = {
    rowsWithoutPlayer: 0,
    rowsWithoutCoordinates: 0,
    duelsWithoutOutcome: 0,
    incompleteCoordinates: 0,
    invalidShirtNumbers: 0,
  }

  rows.forEach((row, i) => {
    const line = i + 2 // la ligne 1 est l'en-tête
    const problems = []
    const cell = (field) => {
      const c = idx[field]
      return c === undefined ? '' : String(row[c] ?? '').trim()
    }

    // --- type d'événement ---
    let eventType = null
    let outcomeFromType = null
    if (!cell('eventType')) {
      problems.push("Type d'événement manquant")
    } else {
      eventType = normalizeEventType(cell('eventType'))
      if (!eventType) {
        problems.push(`Type d'événement inconnu : « ${cell('eventType')} »`)
      } else if (eventType === 'goal') {
        eventType = 'shot'
        outcomeFromType = 'goal'
      }
    }

    // --- équipe ---
    let side = null
    const teamRaw = cell('team')
    if (!teamRaw) {
      problems.push('Équipe manquante')
    } else {
      side = teamLookup.get(key(teamRaw)) ?? SIDE_ALIASES.get(key(teamRaw)) ?? null
      if (!side) {
        problems.push(`Équipe inconnue : « ${teamRaw} » (attendu : ${home.name} ou ${away.name})`)
      }
    }

    // --- temps de jeu ---
    let minute = NaN
    if (!cell('minute')) {
      problems.push('Minute manquante')
    } else {
      minute = parseMinute(cell('minute'))
      if (Number.isNaN(minute) || minute < 0 || minute > 130) {
        problems.push(`Minute invalide : « ${cell('minute')} » (0 à 130 attendu)`)
      }
    }

    let second = 0
    if (cell('second')) {
      const s = parseNumber(cell('second'))
      if (!Number.isInteger(s) || s < 0 || s > 59) {
        problems.push(`Seconde invalide : « ${cell('second')} » (0 à 59 attendu)`)
      } else {
        second = s
      }
    }

    let period = null
    if (cell('period')) {
      const p = parseNumber(cell('period'))
      if (!Number.isInteger(p) || p < 1 || p > 5) {
        problems.push(`Période invalide : « ${cell('period')} » (1 à 5 attendu)`)
      } else {
        period = p
      }
    }
    if (period === null && !Number.isNaN(minute)) {
      period = minute <= 45 ? 1 : minute <= 90 ? 2 : minute <= 105 ? 3 : 4
    }

    let videoTime = null
    if (cell('videoTime')) {
      const v = parseVideoTime(cell('videoTime'))
      if (Number.isNaN(v) || v < 0) {
        problems.push(`Temps vidéo invalide : « ${cell('videoTime')} »`)
      } else {
        videoTime = round2(v)
      }
    }

    // --- coordonnées (converties en pourcentage du terrain) ---
    const readCoord = (field, axis) => {
      const raw = cell(field)
      if (!raw) return null
      const n = parseNumber(raw)
      if (Number.isNaN(n)) {
        problems.push(`Coordonnée invalide (${field}) : « ${raw} »`)
        return null
      }
      const v = round2(scaleCoord(n, axis, options.coordScale))
      if (v < -0.01 || v > 100.01) {
        problems.push(`Coordonnée hors du terrain (${field}) : « ${raw} » avec l'échelle choisie`)
        return null
      }
      return Math.min(100, Math.max(0, v))
    }
    const readPair = (fx, fy) => {
      let px = readCoord(fx, 'x')
      let py = readCoord(fy, 'y')
      if ((px === null) !== (py === null)) {
        warnings.incompleteCoordinates++
        px = null
        py = null
      }
      return [px, py]
    }
    const [x, y] = readPair('x', 'y')

    // --- champs propres à chaque type d'événement ---
    let outcome = null
    let xg = null
    let bodyPart = null
    let endX = null
    let endY = null
    let passSuccess = null
    let keyPass = false

    if (eventType === 'shot') {
      const raw = cell('outcome')
      if (outcomeFromType) {
        outcome = outcomeFromType
      } else if (!raw) {
        problems.push('Résultat du tir manquant')
      } else {
        outcome = normalizeShotOutcome(raw)
        if (!outcome) problems.push(`Résultat du tir inconnu : « ${raw} »`)
      }
      if (cell('xg')) {
        const v = parseNumber(cell('xg'))
        if (Number.isNaN(v) || v < 0 || v > 1) {
          problems.push(`xG invalide : « ${cell('xg')} » (0 à 1 attendu)`)
        } else {
          xg = Math.round(v * 1000) / 1000
        }
      }
      bodyPart = normalizeBodyPart(cell('bodyPart'))
      ;[endX, endY] = readPair('endX', 'endY')
    } else if (eventType === 'pass') {
      const raw = cell('passSuccess')
      if (!raw) {
        problems.push('Réussite de la passe manquante')
      } else {
        const b = parseBool(raw)
        if (b === null) problems.push(`Réussite de la passe inconnue : « ${raw} »`)
        else passSuccess = b
      }
      if (cell('keyPass')) {
        const b = parseBool(cell('keyPass'))
        if (b === null) problems.push(`Valeur « passe clé » inconnue : « ${cell('keyPass')} »`)
        else keyPass = b
      }
      outcome = passSuccess === null ? null : passSuccess ? 'success' : 'failed'
      ;[endX, endY] = readPair('endX', 'endY')
    } else if (eventType === 'duel') {
      const raw = cell('outcome')
      if (raw) {
        outcome = normalizeDuelOutcome(raw)
        if (!outcome) problems.push(`Résultat du duel inconnu : « ${raw} »`)
      } else {
        warnings.duelsWithoutOutcome++
      }
    } else if (eventType) {
      outcome = cell('outcome').slice(0, 100) || null
    }

    // --- joueur ---
    const playerName = cell('player')
    if (playerName.length > 100) problems.push('Nom de joueur trop long (100 caractères maximum)')

    let shirtNumber = null
    if (cell('shirtNumber')) {
      const n = parseNumber(cell('shirtNumber'))
      if (Number.isInteger(n) && n >= 0 && n <= 99) shirtNumber = n
      else warnings.invalidShirtNumbers++
    }

    if (problems.length > 0) {
      errors.push({ row: line, messages: problems })
      return
    }

    if ((eventType === 'shot' || eventType === 'pass') && !playerName) warnings.rowsWithoutPlayer++
    if ((eventType === 'shot' || eventType === 'pass') && x === null) warnings.rowsWithoutCoordinates++

    // Les colonnes non associées sont conservées telles quelles dans metadata.
    const extraEntries = extraCols
      .map(([h, c]) => [h, String(row[c] ?? '').trim().slice(0, 200)])
      .filter(([, v]) => v !== '')
    const metadata = { csv_row: line }
    if (extraEntries.length > 0) metadata.extra = Object.fromEntries(extraEntries)

    records.push({
      csvRow: line,
      eventType,
      side,
      playerName,
      shirtNumber,
      period,
      minute,
      second,
      videoTime,
      x,
      y,
      outcome,
      xg,
      bodyPart,
      endX,
      endY,
      passSuccess,
      keyPass,
      metadata,
    })
  })

  return { records, errors, warnings }
}
