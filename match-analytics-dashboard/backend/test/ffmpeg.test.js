import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { cutClip, FfmpegError } from '../src/video/ffmpeg.js'
import { examplePath } from './helpers.js'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const input = examplePath('video_test_90s.mp4')

test('FFmpeg absent : erreur claire', async () => {
  await assert.rejects(
    cutClip({ input, output: path.join(tmpdir(), 'x.mp4'), start: 0, duration: 5, ffmpegPath: '/chemin/inexistant/ffmpeg' }),
    (err) => err instanceof FfmpegError && err.code === 'FFMPEG_MISSING'
  )
})

test('découpe réelle d\'un clip de 10 s', { skip: !hasFfmpeg || !existsSync(input) && 'FFmpeg ou vidéo de test absents' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'clip-'))
  const output = path.join(dir, 'clip.mp4')
  try {
    await cutClip({ input, output, start: 20.5, duration: 10 })
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', output])
    assert.ok(Math.abs(Number(probe.stdout.toString()) - 10) < 0.6)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('entrée introuvable et délai dépassé', { skip: !hasFfmpeg && 'FFmpeg absent' }, async () => {
  await assert.rejects(
    cutClip({ input: '/tmp/fichier_inexistant.mp4', output: path.join(tmpdir(), 'y.mp4'), start: 0, duration: 5 }),
    (err) => err.code === 'FFMPEG_FAILED' && err.message.length > 0
  )
  if (existsSync(input)) {
    await assert.rejects(
      cutClip({ input, output: path.join(tmpdir(), 'z.mp4'), start: 0, duration: 60, timeoutMs: 1 }),
      (err) => err.code === 'FFMPEG_TIMEOUT'
    )
  }
})
