import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { formatClock } from '../../utils/time.js'
import { CATEGORY_BY_VALUE, TONE_BG } from '../../data/annotationCategories.js'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

const buttonClass = 'rounded-md border border-pitch-600 px-3 py-1.5 text-sm font-medium hover:bg-pitch-700'

// Lecteur avec commandes personnalisées. Le parent pilote le lecteur via la référence :
// seekTo(t), getCurrentTime(), pause().
const VideoPlayer = forwardRef(function VideoPlayer({ src, annotations, eventMarkers = [], onVideoError }, ref) {
  const videoRef = useRef(null)
  const rangeEndRef = useRef(null) // fin de l'extrait en cours de prévisualisation
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)

  const hasDuration = Number.isFinite(duration) && duration > 0

  const seekTo = (t) => {
    const video = videoRef.current
    if (!video) return
    rangeEndRef.current = null
    const max = hasDuration ? duration : Math.max(t, 0)
    video.currentTime = Math.min(Math.max(0, t), max)
    setTime(video.currentTime)
  }

  // Prévisualisation d'une séquence : lecture de `start` à `end`, puis pause automatique.
  const playRange = (start, end) => {
    const video = videoRef.current
    if (!video) return
    rangeEndRef.current = end
    video.currentTime = Math.max(0, start)
    setTime(video.currentTime)
    video.play().catch(() => {})
  }

  useImperativeHandle(ref, () => ({
    seekTo,
    playRange,
    getCurrentTime: () => (videoRef.current ? videoRef.current.currentTime : 0),
    pause: () => videoRef.current && videoRef.current.pause(),
  }))

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    rangeEndRef.current = null
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }

  const skip = (delta) => seekTo((videoRef.current ? videoRef.current.currentTime : 0) + delta)

  const changeRate = (value) => {
    setRate(value)
    if (videoRef.current) videoRef.current.playbackRate = value
  }

  // Raccourcis (quand le lecteur a le focus) : espace = lecture/pause, flèches = ±5 s.
  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key === ' ') {
      e.preventDefault()
      togglePlay()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      skip(-5)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      skip(5)
    }
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Lecteur vidéo (espace : lecture ou pause, flèches : avancer ou reculer de 5 secondes)"
      className="rounded-lg border border-pitch-600 bg-pitch-800"
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onTimeUpdate={(e) => {
          const video = e.currentTarget
          setTime(video.currentTime)
          if (rangeEndRef.current !== null && video.currentTime >= rangeEndRef.current) {
            video.pause()
            rangeEndRef.current = null
          }
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          e.currentTarget.playbackRate = rate
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={onVideoError}
        className="aspect-video w-full rounded-t-lg bg-black"
      />

      <div className="space-y-3 p-4">
        <div>
          <input
            type="range"
            min={0}
            max={hasDuration ? duration : 0}
            step={0.1}
            value={Math.min(time, hasDuration ? duration : 0)}
            disabled={!hasDuration}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Position dans la vidéo"
            className="w-full accent-mint-400"
          />
          <div className="relative h-4" aria-label="Annotations sur la timeline">
            {hasDuration &&
              annotations.map((a) => {
                const category = CATEGORY_BY_VALUE[a.category]
                const left = Math.min(100, (a.startTimeSeconds / duration) * 100)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => seekTo(a.startTimeSeconds)}
                    title={`${formatClock(a.startTimeSeconds)} : ${a.title}`}
                    aria-label={`Aller à ${formatClock(a.startTimeSeconds)} : ${a.title}`}
                    className={`absolute top-0 h-3.5 w-2 -translate-x-1/2 rounded-sm ${TONE_BG[category ? category.tone : 'neutral']}`}
                    style={{ left: `${left}%` }}
                  />
                )
              })}
          </div>
          {hasDuration && eventMarkers.length > 0 && (
            <div className="relative h-2.5" aria-hidden="true">
              {eventMarkers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => seekTo(m.videoTimeSeconds)}
                  title={m.label}
                  className={`absolute top-0 h-2.5 w-1 -translate-x-1/2 rounded-sm opacity-80 ${
                    m.teamSide === 'home' ? 'bg-mint-400' : 'bg-away'
                  }`}
                  style={{ left: `${Math.min(100, (m.videoTimeSeconds / duration) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => skip(-10)} className={buttonClass}>
            -10 s
          </button>
          <button type="button" onClick={() => skip(-5)} className={buttonClass}>
            -5 s
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="min-w-24 rounded-md bg-mint-400 px-4 py-1.5 text-sm font-semibold text-pitch-900 hover:bg-mint-300"
          >
            {playing ? 'Pause' : 'Lecture'}
          </button>
          <button type="button" onClick={() => skip(5)} className={buttonClass}>
            +5 s
          </button>
          <button type="button" onClick={() => skip(10)} className={buttonClass}>
            +10 s
          </button>

          <span className="ml-auto text-sm tabular-nums text-chalk-muted">
            {formatClock(time)} / {formatClock(hasDuration ? duration : 0)}
          </span>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-chalk-muted">Vitesse</span>
            <select
              value={rate}
              onChange={(e) => changeRate(Number(e.target.value))}
              className="rounded-md border border-pitch-600 bg-pitch-900 px-2 py-1.5 text-sm"
            >
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r} x
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  )
})

export default VideoPlayer
