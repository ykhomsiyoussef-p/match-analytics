import { useState } from 'react'
import { ANNOTATION_CATEGORIES } from '../../data/annotationCategories.js'
import { formatClock, parseClock } from '../../utils/time.js'

const inputClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm'

// Création ou modification d'un clip. `initial` : un clip existant, ou un brouillon
// (par exemple depuis une annotation) avec title, category, annotationId, start, end, playerIds.
export default function ClipForm({ roster, annotations, getCurrentTime, initial, isEdit, onSubmit, onPreview, onCancel, busy, error }) {
  const now = getCurrentTime()
  const [title, setTitle] = useState(initial ? initial.title || '' : '')
  const [category, setCategory] = useState(initial && initial.category ? initial.category : 'commentaire_libre')
  const [description, setDescription] = useState(initial && initial.description ? initial.description : '')
  const [start, setStart] = useState(formatClock(initial && initial.start != null ? initial.start : now, true))
  const [end, setEnd] = useState(formatClock(initial && initial.end != null ? initial.end : now + 10, true))
  const [annotationId, setAnnotationId] = useState(initial && initial.annotationId ? String(initial.annotationId) : '')
  const [playerIds, setPlayerIds] = useState(initial && initial.playerIds ? initial.playerIds : [])
  const [localError, setLocalError] = useState('')

  const togglePlayer = (id) =>
    setPlayerIds((list) => (list.includes(id) ? list.filter((p) => p !== id) : [...list, id]))

  const readTimes = () => {
    const s = parseClock(start)
    const e = parseClock(end)
    if (Number.isNaN(s)) return { error: 'Temps de début invalide (exemple : 12:35).' }
    if (Number.isNaN(e)) return { error: 'Temps de fin invalide (exemple : 12:50).' }
    if (e <= s) return { error: 'La fin doit être après le début.' }
    return { s, e }
  }

  const handlePreview = () => {
    const times = readTimes()
    if (times.error) return setLocalError(times.error)
    setLocalError('')
    onPreview(times.s, times.e)
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setLocalError('')
    const times = readTimes()
    if (times.error) return setLocalError(times.error)
    if (!title.trim()) return setLocalError('Le titre est obligatoire.')
    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      category,
      startTimeSeconds: times.s,
      endTimeSeconds: times.e,
      annotationId: annotationId ? Number(annotationId) : null,
      playerIds,
    })
  }

  const duration = (() => {
    const times = readTimes()
    return times.error ? null : Math.round((times.e - times.s) * 10) / 10
  })()

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-mint-400/40 bg-pitch-800 p-5">
      <h2 className="font-display text-lg font-semibold">{isEdit ? 'Modifier le clip' : 'Nouveau clip'}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Titre
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
        </label>
        <label className="block text-sm">
          Catégorie
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {ANNOTATION_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="text-sm">
          <label htmlFor="clip-start">Début (mm:ss)</label>
          <div className="mt-1 flex gap-2">
            <input
              id="clip-start"
              className="w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm tabular-nums"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setStart(formatClock(getCurrentTime(), true))}
              className="whitespace-nowrap rounded-md border border-pitch-600 px-3 text-sm hover:bg-pitch-700"
            >
              Temps courant
            </button>
          </div>
        </div>
        <div className="text-sm">
          <label htmlFor="clip-end">Fin (mm:ss)</label>
          <div className="mt-1 flex gap-2">
            <input
              id="clip-end"
              className="w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm tabular-nums"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setEnd(formatClock(getCurrentTime(), true))}
              className="whitespace-nowrap rounded-md border border-pitch-600 px-3 text-sm hover:bg-pitch-700"
            >
              Temps courant
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs text-chalk-muted">
        {duration !== null ? `Durée du clip : ${duration} s. ` : ''}Pour une séquence précise, lancez la lecture, mettez en
        pause au bon moment puis cliquez sur « Temps courant ».
      </p>

      <label className="block text-sm">
        Annotation liée (facultatif)
        <select className={inputClass} value={annotationId} onChange={(e) => setAnnotationId(e.target.value)}>
          <option value="">Aucune</option>
          {annotations.map((a) => (
            <option key={a.id} value={a.id}>
              {formatClock(a.startTimeSeconds)} : {a.title}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="text-sm">
        <legend>Joueurs concernés (facultatif)</legend>
        {roster.home.players.length + roster.away.players.length === 0 ? (
          <p className="mt-1 text-xs text-chalk-muted">Aucun joueur : ils sont créés par l'importation CSV.</p>
        ) : (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {[roster.home, roster.away].map((team) => (
              <div key={team.id}>
                <p className="text-xs text-chalk-muted">{team.name}</p>
                <div className="mt-1 max-h-36 space-y-1 overflow-y-auto">
                  {team.players.map((p) => (
                    <label key={p.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={playerIds.includes(p.id)} onChange={() => togglePlayer(p.id)} />
                      <span>
                        {p.shirtNumber != null ? `${p.shirtNumber}. ` : ''}
                        {p.fullName}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <label className="block text-sm">
        Description (facultatif)
        <textarea
          className={`${inputClass} min-h-20`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </label>

      {(localError || error) && (
        <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {localError || error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-mint-400 px-5 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60"
        >
          {busy ? 'Enregistrement...' : 'Enregistrer la sélection'}
        </button>
        <button type="button" onClick={handlePreview} className="rounded-md border border-pitch-600 px-4 py-2 text-sm font-medium hover:bg-pitch-700">
          Prévisualiser
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-pitch-600 px-4 py-2 text-sm font-medium hover:bg-pitch-700">
          Annuler
        </button>
      </div>
    </form>
  )
}
