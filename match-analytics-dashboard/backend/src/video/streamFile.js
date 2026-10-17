import * as storage from '../storage/local.js'
import { parseRange } from './range.js'

// Envoie un fichier avec prise en charge de « Range » (avance rapide, saut dans la vidéo).
// `downloadName` : si fourni, le navigateur propose d'enregistrer le fichier.
export function streamFile(req, res, { storageKey, mimeType, total, downloadName = null }) {
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', mimeType)
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (downloadName) res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`)

  let start = 0
  let end = total - 1
  if (req.headers.range) {
    const range = parseRange(req.headers.range, total)
    if (!range) {
      res.setHeader('Content-Range', `bytes */${total}`)
      return res.status(416).end()
    }
    ;({ start, end } = range)
    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`)
  } else {
    res.status(200)
  }
  res.setHeader('Content-Length', end - start + 1)

  const fileStream = storage.createReadStream(storageKey, { start, end })
  fileStream.on('error', () => res.destroy())
  res.on('close', () => fileStream.destroy())
  fileStream.pipe(res)
}
