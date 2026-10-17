import test from 'node:test'
import assert from 'node:assert/strict'
import { filterEvents, mirrorAway, computeStats, availability, playerRows } from '../src/utils/analytics.js'

const shot = (id, side, outcome, extra = {}) => ({
  id, type: 'shot', side, playerId: null, period: 1, minute: 10, second: 0, outcome,
  x: 80, y: 40, endX: null, endY: null, xg: null, onTarget: ['goal', 'saved'].includes(outcome),
  passSuccess: null, keyPass: null, ...extra,
})
const pass = (id, side, ok, extra = {}) => ({
  id, type: 'pass', side, playerId: null, period: 2, minute: 60, second: 0, outcome: ok ? 'success' : 'failed',
  x: 30, y: 30, endX: 50, endY: 50, xg: null, onTarget: null, passSuccess: ok, keyPass: false, ...extra,
})

test('statistiques d\'équipe', () => {
  const events = [shot(1, 'home', 'goal', { xg: 0.4 }), shot(2, 'home', 'saved', { xg: 0.1 }), shot(3, 'home', 'off_target'),
    pass(4, 'home', true), pass(5, 'home', true), pass(6, 'home', false)]
  const s = computeStats(events)
  assert.equal(s.shots, 3)
  assert.equal(s.shotsOnTarget, 2)
  assert.equal(s.goals, 1)
  assert.equal(s.xg, 0.5)
  assert.equal(s.xgShots, 2, 'xG partiel : 2 tirs sur 3')
  assert.equal(s.passAccuracy, 67)
})

test('une statistique sans donnée vaut null, jamais 0', () => {
  const s = computeStats([shot(1, 'home', 'saved')])
  assert.equal(s.xg, null)
  assert.equal(s.passAccuracy, null)
  assert.deepEqual(availability([shot(1, 'home', 'saved')]), {
    shots: true, passes: false, corners: false, interceptions: false, duels: false, xg: false, keyPasses: false,
  })
})

test('filtres par équipe, période, type et joueur', () => {
  const events = [shot(1, 'home', 'goal'), pass(2, 'away', true), pass(3, 'home', false, { playerId: 9 })]
  assert.equal(filterEvents(events, { side: 'home' }).length, 2)
  assert.equal(filterEvents(events, { period: '2' }).length, 2)
  assert.equal(filterEvents(events, { period: 'extra' }).length, 0)
  assert.equal(filterEvents(events, { type: 'shot' }).length, 1)
  assert.equal(filterEvents(events, { playerId: '9' }).length, 1)
})

test('miroir : seule l\'équipe extérieure est retournée, les valeurs absentes restent absentes', () => {
  const [h, a, n] = mirrorAway([
    shot(1, 'home', 'goal', { x: 80, y: 30 }),
    shot(2, 'away', 'goal', { x: 20, y: 30, endX: 0, endY: 50 }),
    { side: 'away', x: null, y: null, endX: null, endY: null },
  ])
  assert.deepEqual([h.x, h.y], [80, 30])
  assert.deepEqual([a.x, a.y, a.endX, a.endY], [80, 70, 100, 50])
  assert.equal(n.x, null)
})

test('lignes par joueur : seuls les joueurs avec une action apparaissent', () => {
  const roster = {
    home: { id: 1, name: 'A', players: [{ id: 5, fullName: 'Joueur 5', shirtNumber: 5 }, { id: 6, fullName: 'Joueur 6', shirtNumber: 6 }] },
    away: { id: 2, name: 'B', players: [] },
  }
  const rows = playerRows([shot(1, 'home', 'goal', { playerId: 5 }), shot(2, 'home', 'saved')], roster)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'Joueur 5')
  assert.equal(rows[0].goals, 1)
})
