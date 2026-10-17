import { useEffect, useMemo, useState } from 'react'
import { EVENT_TYPES, eventTypeLabel, outcomeLabel } from '../../data/eventTypes.js'
import { formatClock } from '../../utils/time.js'

const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const PAGE = 100
const selectClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm'

// Événements du match (importés par CSV), situés dans la vidéo. Les événements filtrés
// sont aussi transmis au parent (onVisibleChange) pour être affichés sur la timeline.
export default function EventList({ events, roster, onSeek, onVisibleChange }) {
  const [type, setType] = useState('')
  const [team, setTeam] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const filtered = useMemo(
    () =>
      events
        .filter((e) => !type || e.type === type)
        .filter((e) => !team || e.teamSide === team)
        .filter((e) => !query.trim() || normalize(e.playerName).includes(normalize(query.trim()))),
    [events, type, team, query]
  )

  useEffect(() => {
    setLimit(PAGE)
  }, [type, team, query])

  useEffect(() => {
    if (!onVisibleChange) return undefined
    onVisibleChange(
      filtered
        .filter((e) => e.videoTimeSeconds !== null)
        .map((e) => ({
          id: e.id,
          videoTimeSeconds: e.videoTimeSeconds,
          teamSide: e.teamSide,
          label: `${formatClock(e.videoTimeSeconds)} : ${eventTypeLabel(e.type)}${e.playerName ? `, ${e.playerName}` : ''}`,
        }))
    )
    return () => onVisibleChange([])
  }, [filtered])

  const located = events.filter((e) => e.videoTimeSeconds !== null).length

  if (events.length === 0) {
    return (
      <p className="text-sm text-chalk-muted">
        Aucun événement pour ce match. Importez un fichier CSV depuis la page « Importation des données ».
      </p>
    )
  }

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-chalk-muted">Type</span>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-chalk-muted">Équipe</span>
          <select className={selectClass} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Les deux</option>
            <option value="home">{roster.home.name}</option>
            <option value="away">{roster.away.name}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-chalk-muted">Joueur</span>
          <input
            type="search"
            className={selectClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher"
          />
        </label>
      </div>

      {located === 0 && (
        <p className="mt-4 rounded-md border border-away/40 bg-away/10 px-3 py-2 text-sm text-away">
          Ces événements ne sont pas encore situés dans la vidéo. Dans « Repères du match », définissez le coup d'envoi
          (et le début de la 2e mi-temps) pour calculer leur position.
        </p>
      )}
      {located > 0 && (
        <p className="mt-3 text-xs text-chalk-muted">
          {filtered.length} événements. Les repères colorés de la barre de position sont ceux de la liste filtrée
          (vert : {roster.home.name}, orange : {roster.away.name}). « ≈ » indique un temps estimé d'après la minute de jeu.
        </p>
      )}

      <ul className="mt-3 divide-y divide-pitch-600">
        {filtered.slice(0, limit).map((e) => {
          const team = e.teamSide === 'home' ? roster.home : roster.away
          const detail = outcomeLabel(e.outcome)
          return (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <button
                type="button"
                disabled={e.videoTimeSeconds === null}
                onClick={() => onSeek(e.videoTimeSeconds)}
                title={e.videoTimeSeconds === null ? "Position dans la vidéo inconnue" : 'Aller à ce moment de la vidéo'}
                className="w-20 shrink-0 rounded-md border border-pitch-600 px-2 py-1 text-center tabular-nums hover:bg-pitch-700 disabled:opacity-40"
              >
                {e.videoTimeSeconds === null
                  ? '—'
                  : `${e.timeSource === 'estimated' ? '≈ ' : ''}${formatClock(e.videoTimeSeconds)}`}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium">{eventTypeLabel(e.type)}</span>
                  {detail ? `, ${detail}` : ''}
                  {e.playerName ? `, ${e.playerName}` : ''}
                </p>
                <p className="text-xs text-chalk-muted">
                  {team.name}, {e.minute}'{e.second ? ` ${String(e.second).padStart(2, '0')}"` : ''}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      {filtered.length === 0 && <p className="mt-3 text-sm text-chalk-muted">Aucun événement ne correspond à ces filtres.</p>}
      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="mt-3 rounded-md border border-pitch-600 px-3 py-1.5 text-sm hover:bg-pitch-700"
        >
          Afficher {Math.min(PAGE, filtered.length - limit)} de plus
        </button>
      )}
    </section>
  )
}
