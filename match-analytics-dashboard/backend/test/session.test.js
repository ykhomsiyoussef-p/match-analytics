import test from 'node:test'
import assert from 'node:assert/strict'
import { isTokenStale } from '../src/users/session.js'

test('un jeton émis avant le changement de mot de passe est refusé', () => {
  const changedAt = new Date('2026-10-10T10:00:00Z')
  const before = Math.floor(changedAt.getTime() / 1000) - 60
  const same = Math.floor(changedAt.getTime() / 1000)
  const after = same + 60
  assert.equal(isTokenStale(before, changedAt), true)
  assert.equal(isTokenStale(same, changedAt), false, 'émis dans la même seconde : accepté')
  assert.equal(isTokenStale(after, changedAt), false)
  assert.equal(isTokenStale(before, changedAt.toISOString()), true, 'date au format texte')
})

test('données manquantes : pas de refus par erreur', () => {
  assert.equal(isTokenStale(undefined, new Date()), false)
  assert.equal(isTokenStale(1000, null), false)
})
