import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRange } from '../src/video/range.js'
import { matchesSignature } from '../src/video/signature.js'
import { estimateVideoTime } from '../src/video/timeline.js'
import { enqueue, isPending } from '../src/video/renderQueue.js'

test('Range : plages valides et invalides', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 })
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 })
  assert.deepEqual(parseRange('bytes=900-5000', 1000), { start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 })
  assert.equal(parseRange('bytes=1000-1100', 1000), null)
  assert.equal(parseRange('bytes=50-10', 1000), null)
  assert.equal(parseRange('bytes=0-1,5-6', 1000), null)
  assert.equal(parseRange(undefined, 1000), null)
})

test('signature : le contenu doit correspondre à une vidéo', () => {
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(8)])
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 1, 0, 0, 0])
  assert.ok(matchesSignature(mp4, 'video/mp4'))
  assert.ok(matchesSignature(webm, 'video/webm'))
  assert.ok(!matchesSignature(mp4, 'video/webm'))
  assert.ok(!matchesSignature(Buffer.from('Un fichier texte renommé en .mp4'), 'video/mp4'))
  assert.ok(!matchesSignature(Buffer.from([1, 2, 3]), 'video/mp4'))
})

test('conversion minute de jeu vers temps vidéo', () => {
  const v = { matchStartOffsetSeconds: 120, secondHalfStartSeconds: 3000 }
  const ev = (o) => ({ minute: 23, second: 15, period: 1, videoTimeSeconds: null, ...o })
  assert.equal(estimateVideoTime(ev({ videoTimeSeconds: 1395 }), v).source, 'csv')
  assert.equal(estimateVideoTime(ev(), v).seconds, 120 + 23 * 60 + 15)
  assert.equal(estimateVideoTime(ev({ minute: 46, second: 0, period: 2 }), v).seconds, 3060)
  assert.equal(estimateVideoTime(ev({ period: 2 }), { ...v, secondHalfStartSeconds: null }).seconds, null)
  assert.equal(estimateVideoTime(ev(), { matchStartOffsetSeconds: 0, secondHalfStartSeconds: null }).seconds, null)
  assert.equal(estimateVideoTime(ev({ period: 3 }), v).seconds, null)
})

test('file d\'attente : un traitement à la fois, pas de doublon, une erreur ne bloque pas', async () => {
  const order = []
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const originalError = console.error
  console.error = () => {}
  try {
    enqueue(901, async () => { order.push('1 début'); await sleep(40); order.push('1 fin') })
    assert.equal(enqueue(901, async () => order.push('doublon')), false)
    enqueue(902, async () => { throw new Error('échec voulu') })
    enqueue(903, async () => { order.push('3') })
    await sleep(250)
  } finally {
    console.error = originalError
  }
  assert.deepEqual(order, ['1 début', '1 fin', '3'])
  assert.equal(isPending(901), false)
})
