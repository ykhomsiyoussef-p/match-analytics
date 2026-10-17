import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestMapping, suggestScale } from '../src/import/importFields.js'
import { analyzeRows, dbEventKey } from '../src/import/analysis.js'
import { readCsv, match, emptyCtx, defaultOptions } from './helpers.js'

test('fichier d\'exemple 1 : tout est valide et le score est cohérent', () => {
  const parsed = readCsv('evenements_exemple.csv')
  const mapping = suggestMapping(parsed.headers)
  assert.equal(Object.keys(mapping).length, 17)
  assert.equal(suggestScale(parsed, mapping), 'percent')
  const { summary } = analyzeRows({ match, parsed, mapping, options: defaultOptions, ctx: emptyCtx() })
  assert.equal(summary.errorRows, 0)
  assert.equal(summary.willImport, 283)
  assert.equal(summary.byType.shot, 20)
  assert.equal(summary.goalsCheck, null)
})

test('fichier d\'exemple 2 : autre format, 3 erreurs volontaires détectées', () => {
  const parsed = readCsv('evenements_exemple_format_different.csv', ';')
  const mapping = suggestMapping(parsed.headers)
  const { summary } = analyzeRows({ match, parsed, mapping, options: defaultOptions, ctx: emptyCtx() })
  assert.equal(summary.errorRows, 3)
  assert.equal(summary.validRows, 92)
  const messages = summary.errors.flatMap((e) => e.messages).join(' | ')
  assert.match(messages, /Équipe inconnue/)
  assert.match(messages, /Minute invalide/)
  assert.match(messages, /Type d'événement inconnu/)
})

test('réimport du même fichier : les doublons sont ignorés (ou importés si demandé)', () => {
  const parsed = readCsv('evenements_exemple.csv')
  const mapping = suggestMapping(parsed.headers)
  const first = analyzeRows({ match, parsed, mapping, options: defaultOptions, ctx: emptyCtx() })

  const ids = new Map()
  let next = 1
  for (const key of first.newPlayers.keys()) ids.set(key, next++)
  const ctx = emptyCtx()
  for (const rec of first.toImport) {
    const pid = ids.get(`${rec.side}|${rec.playerKey}`) ?? null
    ctx.existingKeys.add(dbEventKey({
      event_type: rec.eventType, team_id: rec.side === 'home' ? 10 : 20, player_id: pid,
      match_minute: rec.minute, match_second: rec.second, x: rec.x, y: rec.y,
    }))
    if (rec.playerKey) ctx.playerIndex[rec.side].set(rec.playerKey, ids.get(`${rec.side}|${rec.playerKey}`))
  }
  const again = analyzeRows({ match, parsed, mapping, options: defaultOptions, ctx })
  assert.equal(again.summary.willImport, 0)
  assert.equal(again.summary.skippedDuplicates, 283)
  const all = analyzeRows({ match, parsed, mapping, options: { ...defaultOptions, duplicatePolicy: 'import_all' }, ctx })
  assert.equal(all.summary.willImport, 283)
})

test('coordonnées StatsBomb : conversion, et refus hors du terrain avec la mauvaise échelle', () => {
  const parsed = {
    headers: ['type', 'team', 'minute', 'x', 'y', 'result'],
    rows: [['shot', 'Équipe A', '10', '108', '40', 'goal'], ['shot', 'Équipe B', '12', '12', '70', 'off target']],
  }
  const mapping = suggestMapping(parsed.headers)
  assert.equal(suggestScale(parsed, mapping), 'statsbomb')
  const ok = analyzeRows({ match, parsed, mapping, options: { ...defaultOptions, coordScale: 'statsbomb' }, ctx: emptyCtx() })
  assert.equal(ok.summary.validRows, 2)
  assert.ok(Math.abs(ok.records[0].x - 90) < 0.01)
  const bad = analyzeRows({ match, parsed, mapping, options: defaultOptions, ctx: emptyCtx() })
  assert.equal(bad.summary.errorRows, 1)
})

test('une statistique absente reste absente : jamais de donnée inventée', () => {
  const parsed = { headers: ['type', 'team', 'minute'], rows: [['corner', 'Équipe A', '5']] }
  const mapping = suggestMapping(parsed.headers)
  const { records } = analyzeRows({ match, parsed, mapping, options: defaultOptions, ctx: emptyCtx() })
  assert.equal(records[0].x, null)
  assert.equal(records[0].xg, null)
  assert.equal(records[0].playerName, '')
})
