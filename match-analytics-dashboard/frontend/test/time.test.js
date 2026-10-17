import test from 'node:test'
import assert from 'node:assert/strict'
import { formatClock, parseClock, matchMinuteAt, formatBytes } from '../src/utils/time.js'

test('affichage des temps', () => {
  assert.equal(formatClock(755), '12:35')
  assert.equal(formatClock(3725), '1:02:05')
  assert.equal(formatClock(12.34, true), '0:12.3')
  assert.equal(formatClock(NaN), '0:00')
})

test('lecture des temps saisis', () => {
  assert.equal(parseClock('12:35'), 755)
  assert.equal(parseClock('1:02:03.5'), 3723.5)
  assert.equal(parseClock('0:12,5'), 12.5)
  assert.equal(parseClock('755'), 755)
  assert.ok(Number.isNaN(parseClock('abc')))
  assert.ok(Number.isNaN(parseClock('')))
})

test('aller-retour affichage et lecture', () => {
  assert.ok(Math.abs(parseClock(formatClock(755.4, true)) - 755.4) < 0.001)
})

test('minute de jeu approximative', () => {
  const v = { matchStartOffsetSeconds: 120, secondHalfStartSeconds: 3000 }
  assert.equal(matchMinuteAt(60, v), null)
  assert.equal(matchMinuteAt(120, v), 1)
  assert.equal(matchMinuteAt(3000, v), 46)
  assert.equal(matchMinuteAt(500, { matchStartOffsetSeconds: 0, secondHalfStartSeconds: null }), null)
})

test('tailles de fichier', () => {
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 Mo')
  assert.equal(formatBytes(3 * 1024 ** 3), '3.00 Go')
})
