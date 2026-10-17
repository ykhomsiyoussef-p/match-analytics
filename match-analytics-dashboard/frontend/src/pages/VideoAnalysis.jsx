import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import VideoPlayer from '../components/video/VideoPlayer.jsx'
import VideoUploader from '../components/video/VideoUploader.jsx'
import AnnotationForm from '../components/video/AnnotationForm.jsx'
import AnnotationList from '../components/video/AnnotationList.jsx'
import Tabs from '../components/video/Tabs.jsx'
import EventList from '../components/video/EventList.jsx'
import ClipForm from '../components/video/ClipForm.jsx'
import ClipList from '../components/video/ClipList.jsx'
import { formatBytes, formatClock } from '../utils/time.js'

const selectClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-800 px-3 py-2 text-sm'
const panelClass = 'rounded-lg border border-pitch-600 bg-pitch-800 p-5'

export default function VideoAnalysis() {
  const { user } = useAuth()
  const canWrite = user.role === 'admin' || user.role === 'analyste'
  const [searchParams] = useSearchParams()
  const playerRef = useRef(null)
  const retriedRef = useRef(false)

  const [matches, setMatches] = useState(null)
  const [matchId, setMatchId] = useState(searchParams.get('match') || '')
  const [videos, setVideos] = useState([])
  const [videoId, setVideoId] = useState('')
  const [roster, setRoster] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [events, setEvents] = useState([])
  const [clips, setClips] = useState([])
  const [tab, setTab] = useState('annotations')
  const [visibleEvents, setVisibleEvents] = useState([])
  const [clipForm, setClipForm] = useState(null) // null, ou { clip } (modification), ou { draft } (création)
  const [clipError, setClipError] = useState('')
  const [src, setSrc] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const [formMode, setFormMode] = useState(null) // null, 'new' ou l'annotation à modifier
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const currentVideo = videos.find(
    (v) => String(v.id) === String(videoId) && String(v.matchId) === String(matchId) && v.status === 'prete'
  )
  const readyVideos = videos.filter((v) => String(v.matchId) === String(matchId) && v.status === 'prete')
  const pendingVideos = videos.filter((v) => v.status === 'envoi' || v.status === 'erreur')

  // Liste des matchs.
  useEffect(() => {
    api
      .get('/matches')
      .then(({ matches: list }) => {
        setMatches(list)
        setMatchId((current) => current || (list[0] ? String(list[0].id) : ''))
      })
      .catch((err) => {
        setMatches([])
        setError(errorMessage(err))
      })
  }, [])

  // Changement de match : vidéos et effectif.
  useEffect(() => {
    setVideos([])
    setVideoId('')
    setRoster(null)
    setError('')
    setNotice('')
    if (!matchId) return undefined
    let cancelled = false
    Promise.all([api.get(`/matches/${matchId}/videos`), api.get(`/matches/${matchId}/roster`)])
      .then(([v, r]) => {
        if (cancelled) return
        setVideos(v.videos)
        setRoster(r.roster)
        const first = v.videos.find((x) => x.status === 'prete')
        setVideoId(first ? String(first.id) : '')
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [matchId])

  // Changement de vidéo : annotations et adresse de lecture.
  const currentVideoId = currentVideo ? currentVideo.id : null
  useEffect(() => {
    setAnnotations([])
    setEvents([])
    setClips([])
    setVisibleEvents([])
    setClipForm(null)
    setClipError('')
    setSrc('')
    setPlaybackError('')
    setFormMode(null)
    setFormError('')
    retriedRef.current = false
    if (!currentVideoId) return undefined
    let cancelled = false
    const base = `/matches/${matchId}/videos/${currentVideoId}`
    Promise.all([
      api.get(`${base}/annotations`),
      api.get(`${base}/playback`),
      api.get(`${base}/events`),
      api.get(`${base}/clips`),
    ])
      .then(([a, p, e, c]) => {
        if (cancelled) return
        setAnnotations(a.annotations)
        setSrc(p.url)
        setEvents(e.events)
        setClips(c.clips)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [matchId, currentVideoId])

  // Tant qu'un clip est en cours de traitement, on interroge le serveur toutes les 3 secondes.
  const hasProcessing = clips.some((c) => c.status === 'traitement')
  useEffect(() => {
    if (!hasProcessing || !currentVideoId) return undefined
    const timer = setInterval(async () => {
      try {
        const { clips: list } = await api.get(`/matches/${matchId}/videos/${currentVideoId}/clips`)
        setClips(list)
      } catch {
        // on réessaiera au prochain passage
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [hasProcessing, matchId, currentVideoId])

  const reloadVideos = async (selectId) => {
    const { videos: list } = await api.get(`/matches/${matchId}/videos`)
    setVideos(list)
    setVideoId((current) => {
      const wanted = selectId ?? current
      if (wanted && list.some((v) => String(v.id) === String(wanted) && v.status === 'prete')) return String(wanted)
      const first = list.find((v) => v.status === 'prete')
      return first ? String(first.id) : ''
    })
  }

  // Le lien de lecture est temporaire : en cas d'erreur, on en demande un nouveau une fois.
  const handleVideoError = async () => {
    if (!currentVideoId) return
    if (retriedRef.current) {
      setPlaybackError(
        "Impossible de lire cette vidéo. Son format n'est peut-être pas pris en charge par votre navigateur (préférez MP4 H.264 ou WebM)."
      )
      return
    }
    retriedRef.current = true
    try {
      const { url } = await api.get(`/matches/${matchId}/videos/${currentVideoId}/playback`)
      setSrc(url)
    } catch (err) {
      setPlaybackError(errorMessage(err))
    }
  }

  const startAnnotation = () => {
    if (playerRef.current) playerRef.current.pause()
    setClipForm(null)
    setTab('annotations')
    setFormError('')
    setNotice('')
    setFormMode('new')
  }

  const handleSubmitAnnotation = async (payload) => {
    setBusy(true)
    setFormError('')
    const base = `/matches/${matchId}/videos/${currentVideoId}/annotations`
    try {
      if (formMode === 'new') {
        const { annotation } = await api.post(base, payload)
        setAnnotations((list) => [...list, annotation])
      } else {
        const { annotation } = await api.put(`${base}/${formMode.id}`, payload)
        setAnnotations((list) => list.map((a) => (a.id === annotation.id ? annotation : a)))
      }
      setFormMode(null)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteAnnotation = async (annotation) => {
    if (!window.confirm(`Supprimer l'annotation « ${annotation.title} » ?`)) return
    try {
      await api.delete(`/matches/${matchId}/videos/${currentVideoId}/annotations/${annotation.id}`)
      setAnnotations((list) => list.filter((a) => a.id !== annotation.id))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Repères : instant de la vidéo où commencent le match et la 2e mi-temps.
  const markNow = async (field) => {
    const t = playerRef.current ? playerRef.current.getCurrentTime() : 0
    setError('')
    try {
      const { video } = await api.patch(`/matches/${matchId}/videos/${currentVideoId}`, {
        [field]: Number(t.toFixed(2)),
      })
      setVideos((list) => list.map((v) => (v.id === video.id ? video : v)))
      const { events: refreshed } = await api.get(`/matches/${matchId}/videos/${currentVideoId}/events`)
      setEvents(refreshed)
      setNotice('Repère enregistré.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const handleDeleteVideo = async (video) => {
    if (!window.confirm(`Supprimer la vidéo « ${video.fileName} » et toutes ses annotations ?`)) return
    setError('')
    try {
      await api.delete(`/matches/${matchId}/videos/${video.id}`)
      await reloadVideos()
      setNotice('Vidéo supprimée.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const clipsBase = () => `/matches/${matchId}/videos/${currentVideoId}/clips`

  const newClip = (draft = null) => {
    if (playerRef.current) playerRef.current.pause()
    setFormMode(null)
    setClipError('')
    setClipForm({ draft })
    setTab('clips')
  }

  const clipFromAnnotation = (a) =>
    newClip({
      title: a.title,
      category: a.category,
      annotationId: a.id,
      start: a.startTimeSeconds,
      end: a.endTimeSeconds != null ? a.endTimeSeconds : a.startTimeSeconds + 10,
      playerIds: a.playerId ? [a.playerId] : [],
    })

  const editClip = (clip) => {
    setFormMode(null)
    setClipError('')
    setClipForm({
      clip,
      draft: {
        title: clip.title,
        description: clip.description,
        category: clip.category,
        annotationId: clip.annotationId,
        start: clip.startTimeSeconds,
        end: clip.endTimeSeconds,
        playerIds: clip.players.map((p) => p.id),
      },
    })
  }

  const handleSubmitClip = async (payload) => {
    setBusy(true)
    setClipError('')
    try {
      const sortClips = (list) => [...list].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
      if (clipForm.clip) {
        const { clip } = await api.put(`${clipsBase()}/${clipForm.clip.id}`, payload)
        setClips((list) => sortClips(list.map((c) => (c.id === clip.id ? clip : c))))
      } else {
        const { clip } = await api.post(clipsBase(), payload)
        setClips((list) => sortClips([...list, clip]))
      }
      setClipForm(null)
    } catch (err) {
      setClipError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRenderClip = async (clip) => {
    setError('')
    try {
      const { clip: updated } = await api.post(`${clipsBase()}/${clip.id}/render`)
      setClips((list) => list.map((c) => (c.id === updated.id ? updated : c)))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const handleDeleteClip = async (clip) => {
    if (!window.confirm(`Supprimer le clip « ${clip.title} » ?`)) return
    try {
      await api.delete(`${clipsBase()}/${clip.id}`)
      setClips((list) => list.filter((c) => c.id !== clip.id))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const getClipUrl = async (clip) => {
    const { url } = await api.get(`${clipsBase()}/${clip.id}/playback`)
    return url
  }

  const previewRange = (start, end) => {
    if (playerRef.current) playerRef.current.playRange(start, end)
  }

  const canEditClip = (c) => canWrite && (user.role === 'admin' || c.createdBy === user.id)

  const canEditAnnotation = (a) => canWrite && (user.role === 'admin' || a.authorId === user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Analyse vidéo</h1>
        <p className="mt-2 max-w-prose text-chalk-muted">
          Regardez le match, annotez les séquences importantes et retrouvez-les en un clic.
        </p>
      </div>

      {matches === null && <p className="text-chalk-muted">Chargement...</p>}

      {matches !== null && matches.length === 0 && (
        <p className="text-chalk-muted">
          Vous n'avez pas encore de match.{' '}
          <Link to="/matchs/nouveau" className="text-mint-400 underline">
            Créez-en un
          </Link>{' '}
          avant d'ajouter une vidéo.
        </p>
      )}

      {matches !== null && matches.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Match</span>
              <select className={selectClass} value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.home.name} contre {m.away.name}, {m.matchDate}
                    {m.isDemo ? ' (démonstration)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {readyVideos.length > 0 && (
              <div className="text-sm">
                <label htmlFor="video-select" className="font-medium">
                  Vidéo
                </label>
                <div className="flex gap-2">
                  <select
                    id="video-select"
                    className={selectClass}
                    value={videoId}
                    onChange={(e) => setVideoId(e.target.value)}
                  >
                    {readyVideos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.fileName} ({formatBytes(v.sizeBytes)})
                      </option>
                    ))}
                  </select>
                  {canWrite && currentVideo && (
                    <button
                      type="button"
                      onClick={() => handleDeleteVideo(currentVideo)}
                      className="mt-1 whitespace-nowrap rounded-md border border-red-400/40 px-3 text-sm text-red-300 hover:bg-red-400/10"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-md border border-mint-400/40 bg-mint-400/10 px-4 py-3 text-sm text-mint-300">
              {notice}
            </p>
          )}

          {!currentVideo && (
            <p className="text-chalk-muted">
              {canWrite
                ? "Aucune vidéo prête pour ce match. Ajoutez-en une ci-dessous."
                : "Aucune vidéo n'est disponible pour ce match."}
            </p>
          )}

          {currentVideo && roster && (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="space-y-6 lg:col-span-3">
                {playbackError && (
                  <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                    {playbackError}
                  </p>
                )}
                {src ? (
                  <VideoPlayer
                    key={currentVideo.id}
                    ref={playerRef}
                    src={src}
                    annotations={annotations}
                    eventMarkers={tab === 'events' ? visibleEvents : []}
                    onVideoError={handleVideoError}
                  />
                ) : (
                  <p className="text-chalk-muted">Chargement de la vidéo...</p>
                )}

                {canWrite && formMode === null && clipForm === null && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={startAnnotation}
                      className="rounded-md bg-mint-400 px-5 py-2.5 text-sm font-semibold text-pitch-900 hover:bg-mint-300"
                    >
                      Annoter à cet instant
                    </button>
                    <button
                      type="button"
                      onClick={() => newClip()}
                      className="rounded-md border border-pitch-600 px-5 py-2.5 text-sm font-medium hover:bg-pitch-700"
                    >
                      Créer un clip
                    </button>
                  </div>
                )}

                {canWrite && clipForm !== null && (
                  <ClipForm
                    key={clipForm.clip ? clipForm.clip.id : 'new'}
                    roster={roster}
                    annotations={annotations}
                    getCurrentTime={() => (playerRef.current ? playerRef.current.getCurrentTime() : 0)}
                    initial={clipForm.draft}
                    isEdit={Boolean(clipForm.clip)}
                    onSubmit={handleSubmitClip}
                    onPreview={previewRange}
                    onCancel={() => setClipForm(null)}
                    busy={busy}
                    error={clipError}
                  />
                )}

                {canWrite && formMode !== null && clipForm === null && (
                  <AnnotationForm
                    key={formMode === 'new' ? 'new' : formMode.id}
                    roster={roster}
                    getCurrentTime={() => (playerRef.current ? playerRef.current.getCurrentTime() : 0)}
                    initial={formMode === 'new' ? null : formMode}
                    onSubmit={handleSubmitAnnotation}
                    onCancel={() => setFormMode(null)}
                    busy={busy}
                    error={formError}
                  />
                )}

                {canWrite && (
                  <section className={panelClass}>
                    <h2 className="font-display text-lg font-semibold">Repères du match</h2>
                    <p className="mt-1 text-sm text-chalk-muted">
                      Le temps de la vidéo n'est pas la minute de jeu. Placez la lecture sur le coup d'envoi, puis sur
                      le début de la 2e mi-temps, pour afficher la minute de jeu approximative de chaque annotation.
                    </p>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-chalk-muted">Coup d'envoi</dt>
                        <dd className="tabular-nums">
                          {currentVideo.matchStartOffsetSeconds > 0
                            ? formatClock(currentVideo.matchStartOffsetSeconds, true)
                            : 'Non défini'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-chalk-muted">Début de la 2e mi-temps</dt>
                        <dd className="tabular-nums">
                          {currentVideo.secondHalfStartSeconds != null
                            ? formatClock(currentVideo.secondHalfStartSeconds, true)
                            : 'Non défini'}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => markNow('matchStartOffsetSeconds')}
                        className="rounded-md border border-pitch-600 px-3 py-2 text-sm hover:bg-pitch-700"
                      >
                        Coup d'envoi = temps courant
                      </button>
                      <button
                        type="button"
                        onClick={() => markNow('secondHalfStartSeconds')}
                        className="rounded-md border border-pitch-600 px-3 py-2 text-sm hover:bg-pitch-700"
                      >
                        2e mi-temps = temps courant
                      </button>
                    </div>
                  </section>
                )}
              </div>

              <div className="lg:col-span-2">
                <div className={`${panelClass}`}>
                  <Tabs
                    label="Annotations, événements et clips"
                    active={tab}
                    onChange={setTab}
                    tabs={[
                      { id: 'annotations', label: 'Annotations', count: annotations.length },
                      { id: 'events', label: 'Événements', count: events.length },
                      { id: 'clips', label: 'Clips', count: clips.length },
                    ]}
                  >
                    {tab === 'annotations' && (
                      <AnnotationList
                        annotations={annotations}
                        roster={roster}
                        video={currentVideo}
                        canEdit={canEditAnnotation}
                        onSeek={(t) => playerRef.current && playerRef.current.seekTo(t)}
                        onEdit={(a) => {
                          setClipForm(null)
                          setFormError('')
                          setFormMode(a)
                        }}
                        onDelete={handleDeleteAnnotation}
                        onCreateClip={canWrite ? clipFromAnnotation : undefined}
                      />
                    )}
                    {tab === 'events' && (
                      <EventList
                        events={events}
                        roster={roster}
                        onSeek={(t) => playerRef.current && playerRef.current.seekTo(t)}
                        onVisibleChange={setVisibleEvents}
                      />
                    )}
                    {tab === 'clips' && (
                      <ClipList
                        clips={clips}
                        canEdit={canEditClip}
                        onPreview={previewRange}
                        onEdit={editClip}
                        onDelete={handleDeleteClip}
                        onRender={handleRenderClip}
                        getPlaybackUrl={getClipUrl}
                      />
                    )}
                  </Tabs>
                </div>
              </div>
            </div>
          )}

          {canWrite && pendingVideos.length > 0 && (
            <section className={panelClass}>
              <h2 className="font-display text-lg font-semibold">Envois incomplets</h2>
              <ul className="mt-3 divide-y divide-pitch-600">
                {pendingVideos.map((v) => (
                  <li key={v.id} className="space-y-3 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">{v.fileName}</p>
                        <p className="text-chalk-muted">
                          {v.status === 'erreur'
                            ? 'Fichier refusé : son contenu ne correspond pas à une vidéo valide.'
                            : `${formatBytes(v.uploadedBytes)} envoyés sur ${formatBytes(v.sizeBytes)}.`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteVideo(v)}
                        className="rounded-md border border-red-400/40 px-3 py-1.5 text-red-300 hover:bg-red-400/10"
                      >
                        Supprimer
                      </button>
                    </div>
                    {v.status === 'envoi' && (
                      <VideoUploader matchId={matchId} resumeVideo={v} onDone={() => reloadVideos(v.id)} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {canWrite && (
            <section className={panelClass}>
              <h2 className="font-display text-lg font-semibold">Ajouter une vidéo</h2>
              <p className="mt-1 text-sm text-chalk-muted">
                L'envoi se fait par morceaux : en cas de coupure, vous pouvez le reprendre là où il s'est arrêté.
              </p>
              <div className="mt-4">
                <VideoUploader key={matchId} matchId={matchId} onDone={(video) => reloadVideos(video.id)} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
