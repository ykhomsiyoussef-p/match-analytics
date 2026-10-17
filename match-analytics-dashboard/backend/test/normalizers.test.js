import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMinute, parseVideoTime, parseNumber, parseBool, normalizeEventType,
  normalizeShotOutcome, scaleCoord, key,
} from '../src/import/normalizers.js'

test('minutes : entière, temps additionnel, décimale refusée', () => {
  assert.equal(parseMinute('23'), 23)
  assert.equal(parseMinute('45+2'), 47)
  assert.ok(Number.isNaN(parseMinute('23.5')))
  assert.ok(Number.isNaN(parseMinute('abc')))
})

test('temps vidéo : secondes, mm:ss, h:mm:ss', () => {
  assert.equal(parseVideoTime('1395'), 1395)
  assert.equal(parseVideoTime('23:15'), 1395)
  assert.equal(parseVideoTime('1:03:20'), 3800)
  assert.ok(Number.isNaN(parseVideoTime('1:2:3:4')))
})

test('nombres avec virgule décimale', () => {
  assert.equal(parseNumber('0,35'), 0.35)
  assert.ok(Number.isNaN(parseNumber('')))
})

test('booléens en français et en anglais', () => {
  assert.equal(parseBool('Oui'), true)
  assert.equal(parseBool('Non'), false)
  assert.equal(parseBool('success'), true)
  assert.equal(parseBool('?'), null)
})

test('types d\'événement et résultats de tir (accents ignorés)', () => {
  assert.equal(normalizeEventType('But'), 'goal')
  assert.equal(normalizeEventType('Dribble'), null, 'type inconnu : refusé, jamais deviné')
  assert.equal(normalizeEventType('Évènement tactique'), 'tactical')
  assert.equal(normalizeEventType('Tactique'), 'tactical')
  assert.equal(normalizeShotOutcome('Non cadré'), 'off_target')
  assert.equal(normalizeShotOutcome('Cadré'), 'saved')
  assert.equal(key('Équipe'), 'equipe')
})

test('échelles de coordonnées', () => {
  assert.equal(scaleCoord(120, 'x', 'statsbomb'), 100)
  assert.equal(scaleCoord(80, 'y', 'statsbomb'), 100)
  assert.equal(scaleCoord(0.5, 'x', 'unit'), 50)
  assert.ok(Math.abs(scaleCoord(52.5, 'x', 'meters') - 50) < 1e-9)
})
