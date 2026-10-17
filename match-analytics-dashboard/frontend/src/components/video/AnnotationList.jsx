import { useState } from 'react'
import { ANNOTATION_CATEGORIES, CATEGORY_BY_VALUE, TONE_BG } from '../../data/annotationCategories.js'
import { formatClock, matchMinuteAt } from '../../utils/time.js'

const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export default function AnnotationList({ annotations, roster, video, canEdit, onSeek, onEdit, onDelete, onCreateClip }) {
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')

  const filtered = annotations
    .filter((a) => !category || a.category === category)
    .filter((a) => !query.trim() || normalize(a.playerName).includes(normalize(query.trim())))
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)

  return (
    <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
      <h2 className="font-display text-lg font-semibold">Annotations ({annotations.length})</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-chalk-muted">Catégorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm"
          >
            <option value="">Toutes</option>
            {ANNOTATION_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-chalk-muted">Joueur</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un joueur"
            className="mt-1 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {annotations.length === 0 && (
        <p className="mt-4 text-sm text-chalk-muted">
          Aucune annotation pour cette vidéo. Mettez la lecture en pause à l'instant voulu, puis cliquez sur « Annoter
          à cet instant ».
        </p>
      )}
      {annotations.length > 0 && filtered.length === 0 && (
        <p className="mt-4 text-sm text-chalk-muted">Aucune annotation ne correspond à ces filtres.</p>
      )}

      <ul className="mt-4 divide-y divide-pitch-600">
        {filtered.map((a) => {
          const cat = CATEGORY_BY_VALUE[a.category]
          const minute = matchMinuteAt(a.startTimeSeconds, video)
          const team = roster[a.teamSide]
          return (
            <li key={a.id} className="py-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onSeek(a.startTimeSeconds)}
                  title="Aller à ce moment de la vidéo"
                  className="shrink-0 rounded-md border border-pitch-600 px-2.5 py-1 text-sm font-semibold tabular-nums hover:bg-pitch-700"
                >
                  {formatClock(a.startTimeSeconds)}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${TONE_BG[cat ? cat.tone : 'neutral']}`}
                      aria-hidden="true"
                    />
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-xs text-chalk-muted">
                    {cat ? cat.label : a.category}, {team ? team.name : ''}
                    {a.playerName ? `, ${a.playerName}` : ''}
                    {minute != null ? `, environ ${minute}'` : ''}
                    {a.endTimeSeconds != null ? `, jusqu'à ${formatClock(a.endTimeSeconds)}` : ''}
                  </p>
                  {a.description && <p className="mt-1 line-clamp-3 text-sm">{a.description}</p>}
                  <p className="mt-1 text-xs text-chalk-muted">Par {a.authorName}</p>
                </div>
              </div>
              {(canEdit(a) || onCreateClip) && (
                <div className="mt-2 flex gap-3 pl-[3.75rem] text-sm">
                  {onCreateClip && (
                    <button type="button" onClick={() => onCreateClip(a)} className="text-mint-400 underline">
                      Créer un clip
                    </button>
                  )}
                  {canEdit(a) && (
                    <>
                      <button type="button" onClick={() => onEdit(a)} className="text-mint-400 underline">
                        Modifier
                      </button>
                      <button type="button" onClick={() => onDelete(a)} className="text-red-300 underline">
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
