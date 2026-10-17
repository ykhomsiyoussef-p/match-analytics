import { useRef, useState } from 'react'
import { api, errorMessage } from '../../api/client.js'
import { detectMime, uploadVideoFile, MAX_VIDEO_BYTES } from '../../api/videoUpload.js'
import { formatBytes } from '../../utils/time.js'

// Envoi d'une vidéo (nouvelle, ou reprise d'un envoi interrompu si `resumeVideo` est fourni).
export default function VideoUploader({ matchId, resumeVideo = null, onDone }) {
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const fileRef = useRef(null)
  const videoRef = useRef(resumeVideo)
  const [phase, setPhase] = useState('idle') // idle | uploading | interrupted
  const [progress, setProgress] = useState({ sent: 0, total: 0 })
  const [error, setError] = useState('')

  const run = async (file, video, startAt) => {
    setPhase('uploading')
    setError('')
    setProgress({ sent: startAt, total: file.size })
    abortRef.current = new AbortController()
    try {
      await uploadVideoFile({
        matchId,
        videoId: video.id,
        file,
        startAt,
        signal: abortRef.current.signal,
        onProgress: (sent, total) => setProgress({ sent, total }),
      })
      fileRef.current = null
      if (!resumeVideo) videoRef.current = null
      setPhase('idle')
      if (onDone) onDone(video)
    } catch (err) {
      setPhase('interrupted')
      setError(err.name === 'AbortError' ? 'Envoi suspendu.' : errorMessage(err))
    }
  }

  const serverOffset = async (video) => {
    const { video: status } = await api.get(`/matches/${matchId}/videos/${video.id}`)
    return status.uploadedBytes
  }

  const handleFile = async (file) => {
    setError('')
    const mime = detectMime(file)
    if (!mime) return setError('Format non pris en charge : choisissez un fichier MP4, MOV ou WebM.')
    if (file.size === 0) return setError('Le fichier est vide.')
    if (file.size > MAX_VIDEO_BYTES) return setError(`Vidéo trop volumineuse (${formatBytes(MAX_VIDEO_BYTES)} maximum).`)

    try {
      if (videoRef.current) {
        if (file.size !== Number(videoRef.current.sizeBytes)) {
          return setError("Ce fichier n'a pas la même taille que l'envoi initial : choisissez exactement le même fichier.")
        }
        fileRef.current = file
        await run(file, videoRef.current, await serverOffset(videoRef.current))
      } else {
        const { video } = await api.post(`/matches/${matchId}/videos`, {
          fileName: file.name,
          mimeType: mime,
          sizeBytes: file.size,
        })
        videoRef.current = video
        fileRef.current = file
        await run(file, video, 0)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const resume = async () => {
    try {
      await run(fileRef.current, videoRef.current, await serverOffset(videoRef.current))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const percent = progress.total > 0 ? Math.floor((progress.sent / progress.total) * 100) : 0

  return (
    <div className="space-y-3">
      {phase === 'idle' && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300"
          >
            {resumeVideo ? 'Sélectionner le fichier pour reprendre' : 'Choisir une vidéo'}
          </button>
          {!resumeVideo && <span className="text-xs text-chalk-muted">MP4, MOV ou WebM, 2 Go maximum</span>}
          <input
            ref={inputRef}
            type="file"
            accept=".mp4,.m4v,.mov,.webm,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {phase === 'uploading' && (
        <div>
          <div className="flex items-center justify-between text-sm">
            <span>
              Envoi en cours : {formatBytes(progress.sent)} sur {formatBytes(progress.total)}
            </span>
            <span className="tabular-nums">{percent} %</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Progression de l'envoi"
            className="mt-2 h-2 overflow-hidden rounded-full bg-pitch-700"
          >
            <div className="h-full bg-mint-400 transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="mt-3 rounded-md border border-pitch-600 px-3 py-1.5 text-sm hover:bg-pitch-700"
          >
            Suspendre l'envoi
          </button>
        </div>
      )}

      {phase === 'interrupted' && fileRef.current && (
        <button
          type="button"
          onClick={resume}
          className="rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300"
        >
          Reprendre l'envoi
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
