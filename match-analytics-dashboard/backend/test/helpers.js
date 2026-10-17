import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
export const examplePath = (name) => path.join(here, '..', '..', 'exemples', name)

// Lecture simple d'un CSV d'exemple (sans guillemets) pour les tests.
export function readCsv(name, delimiter = ',') {
  const text = readFileSync(examplePath(name), 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(Boolean).map((l) => l.split(delimiter))
  return { headers: lines[0], rows: lines.slice(1) }
}

export const match = {
  id: 1, homeScore: 2, awayScore: 1,
  home: { id: 10, name: 'Équipe A' },
  away: { id: 20, name: 'Équipe B' },
}
export const emptyCtx = () => ({ playerIndex: { home: new Map(), away: new Map() }, existingKeys: new Set() })
export const defaultOptions = { coordScale: 'percent', duplicatePolicy: 'skip_existing' }
