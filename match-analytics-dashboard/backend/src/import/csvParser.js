import { parse } from 'csv-parse/sync'
import { HttpError } from '../utils/httpError.js'
import { FIELD_KEYS, REQUIRED_FIELDS } from './importFields.js'

export const MAX_ROWS = 20000
export const MAX_COLUMNS = 100

// Détecte le séparateur (virgule, point-virgule ou tabulation) sur la ligne d'en-tête.
function detectDelimiter(text) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch in counts) counts[ch]++
  }
  const [best, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return bestCount > 0 ? best : ','
}

export function parseCsvText(text) {
  // Un fichier binaire (image, Excel, etc.) contient des caractères nuls.
  if (text.includes('\u0000')) {
    throw new HttpError(400, 'Le fichier ne ressemble pas à un fichier CSV texte.')
  }

  const delimiter = detectDelimiter(text)
  let records
  try {
    records = parse(text, {
      delimiter,
      bom: true,
      skip_empty_lines: true,
      skip_records_with_empty_values: true,
      relax_column_count: true,
      relax_quotes: true,
      trim: true,
    })
  } catch (err) {
    throw new HttpError(400, `Fichier CSV illisible : ${err.message}`)
  }

  if (records.length < 2) {
    throw new HttpError(400, "Le fichier doit contenir une ligne d'en-tête et au moins une ligne de données.")
  }

  const headers = records[0].map((h, i) => (h && String(h).trim()) || `Colonne ${i + 1}`)
  if (headers.length > MAX_COLUMNS) {
    throw new HttpError(400, `Trop de colonnes (${MAX_COLUMNS} maximum).`)
  }
  const seen = new Set()
  for (const h of headers) {
    if (seen.has(h)) throw new HttpError(400, `Deux colonnes portent le même nom : « ${h} ».`)
    seen.add(h)
  }

  const rows = records.slice(1)
  if (rows.length > MAX_ROWS) {
    throw new HttpError(400, `Trop de lignes (${MAX_ROWS} maximum par fichier).`)
  }

  return { delimiter, headers, rows }
}

// Vérifie que la correspondance envoyée est cohérente avec le fichier.
export function assertMapping(parsed, mapping) {
  const headers = new Set(parsed.headers)
  for (const [field, header] of Object.entries(mapping)) {
    if (!FIELD_KEYS.includes(field)) throw new HttpError(400, `Champ inconnu : ${field}`)
    if (header && !headers.has(header)) {
      throw new HttpError(400, `Colonne introuvable dans le fichier : « ${header} »`)
    }
  }
  const missing = REQUIRED_FIELDS.filter((f) => !mapping[f.key])
  if (missing.length > 0) {
    throw new HttpError(400, `Associez les champs obligatoires : ${missing.map((f) => f.label).join(', ')}`)
  }
}
