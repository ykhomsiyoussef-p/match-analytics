import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))

// Le PDF et l'écran utilisent les mêmes formules : les deux fichiers doivent rester identiques.
test('les statistiques du PDF (backend) sont identiques à celles de l\'écran (frontend)', () => {
  const backend = readFileSync(path.join(here, '..', 'src', 'reports', 'analytics.js'), 'utf8')
  const frontend = readFileSync(path.join(here, '..', '..', 'frontend', 'src', 'utils', 'analytics.js'), 'utf8')
  assert.equal(backend.split('\n').slice(1).join('\n'), frontend)
})
