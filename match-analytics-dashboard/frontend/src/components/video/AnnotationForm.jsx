import { useState } from 'react'
import { ANNOTATION_CATEGORIES } from '../../data/annotationCategories.js'
import { formatClock, parseClock } from '../../utils/time.js'

const inputClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm'

// Création ou modification d'une annotation. À l'ouverture, le temps de début est le temps
// courant du lecteur (getCurrentTime) ; le bouton « Temps courant » le met à jour.
export default function AnnotationForm({ roster, getCurrentTime, initial, onSubmit, onCancel, busy, error }) {
  const [category, setCategory] = useState(initial ? initial.category : 'commentaire_libre')
  const [title, setTitle] = useState(initial ? initial.title : '')
  const [description, setDescription] = useState(initial && initial.description ? initial.description : '')
  const [teamId, setTeamId] = useState(String(initial ? initial.teamId : roster.home.id))
  const [playerId, setPlayerId] = useState(initial && initial.playerId ? String(initial.playerId) : '')
  const [start, setStart] = useState(formatClock(initial ? initial.startTimeSeconds : getCurrentTime(), true))
  const [end, setEnd] = useState(initial && initial.endTimeSeconds != null ? formatClock(initial.endTimeSeconds, true) : '')
  const [localError, setLocalError] = useState('')

  const team = String(roster.home.id) === teamId ? roster.home : roster.away

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')

    const startSeconds = parseClock(start)
    if (Number.isNaN(startSeconds)) return setLocalError('Temps de début invalide (exemple : 12:35).')

    let endSeconds = null
    if (end.trim() !== '') {
      endSeconds = parseClock(end)
      if (Number.isNaN(endSeconds)) return setLocalError('Temps de fin invalide (exemple : 12:50).')
      if (endSeconds < startSeconds) return setLocalError('La fin doit être après le début.')
    }
    if (!title.trim()) return setLocalError('Le titre est obligatoire.')

    await onSubmit({
      teamId: Number(teamId),
      playerId: playerId ? Number(playerId) : null,
      category,
      title: title.trim(),
      description: description.trim() || null,
      startTimeSeconds: startSeconds,
      endTimeSeconds: endSeconds,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-mint-400/40 bg-pitch-800 p-5">
      <h2 className="font-display text-lg font-semibold">
        {initial ? "Modifier l'annotation" : 'Nouvelle annotation'}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <label className="block text-sm">
          Titre
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            required
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Équipe
          <select
            className={inputClass}
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value)
              setPlayerId('')
            }}
          >
            <option value={roster.home.id}>{roster.home.name}</option>
            <option value={roster.away.id}>{roster.away.name}</option>
          </select>
        </label>
        <label className="block text-sm">
          Joueur (facultatif)
          <select className={inputClass} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Aucun joueur</option>
            {team.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.shirtNumber != null ? `${p.shirtNumber}. ` : ''}
                {p.fullName}
              </option>
            ))}
          </select>
          {team.players.length === 0 && (
            <span className="mt-1 block text-xs text-chalk-muted">
              Aucun joueur pour cette équipe : ils sont créés par l'importation CSV.
            </span>
          )}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="text-sm">
          <label htmlFor="annotation-start">Début (mm:ss)</label>
          <div className="mt-1 flex gap-2">
            <input
              id="annotation-start"
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
          <label htmlFor="annotation-end">Fin (facultatif)</label>
          <div className="mt-1 flex gap-2">
            <input
              id="annotation-end"
              className="w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm tabular-nums"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="aucune"
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

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-mint-400 px-5 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60"
        >
          {busy ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-pitch-600 px-4 py-2 text-sm font-medium hover:bg-pitch-700"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
