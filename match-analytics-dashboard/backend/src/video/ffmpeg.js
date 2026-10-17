import { spawn } from 'node:child_process'

export class FfmpegError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code // 'FFMPEG_MISSING' | 'FFMPEG_TIMEOUT' | 'FFMPEG_FAILED'
  }
}

// Découpe [start, start + duration] d'une vidéo vers un nouveau fichier MP4 (H.264 + AAC).
// Les arguments sont passés sous forme de liste (aucun shell) : pas d'injection de commande possible.
export function cutClip({ input, output, start, duration, ffmpegPath = 'ffmpeg', timeoutMs = 15 * 60 * 1000 }) {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', start.toFixed(3),
    '-i', input,
    '-t', duration.toFixed(3),
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-threads', '2',
    output,
  ]

  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (err) {
      return reject(new FfmpegError('FFMPEG_FAILED', err.message))
    }

    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-2000)
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      if (err.code === 'ENOENT') reject(new FfmpegError('FFMPEG_MISSING', 'FFmpeg est introuvable'))
      else reject(new FfmpegError('FFMPEG_FAILED', err.message))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return reject(new FfmpegError('FFMPEG_TIMEOUT', 'Délai de traitement dépassé'))
      if (code === 0) return resolve()
      const lastLine = stderr.trim().split('\n').filter(Boolean).pop() || `code de sortie ${code}`
      reject(new FfmpegError('FFMPEG_FAILED', lastLine.slice(0, 200)))
    })
  })
}
