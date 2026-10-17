import { useState } from 'react'
import { CATEGORY_BY_VALUE } from '../../data/annotationCategories.js'
import { formatClock } from '../../utils/time.js'

const selectClass = 'w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm'

// Modification : zone de texte + choix des annotations et clips à joindre.
// Lecture : texte, éléments liés, et lecture des clips joints.
export default function ReportSection({ section, value, onChange, links, onLinksChange, editable, attachables, onOpenClip, openClip }) {
  const [choice, setChoice] = useState('')
  const mine = links.filter((l) => l.section === section.link)

  const addLink = () => {
    if (!choice) return
    const [kind, id] = choice.split(':')
    const item = kind === 'a' ? { annotationId: Number(id), clipId: null } : { annotationId: null, clipId: Number(id) }
    if (mine.some((l) => l.annotationId === item.annotationId && l.clipId === item.clipId)) return
    onLinksChange([...links, { section: section.link, ...item }])
    setChoice('')
  }
  const removeLink = (target) => onLinksChange(links.filter((l) => l !== target))

  const describe = (l) => {
    if (l.clipId) {
      const c = attachables.clips.find((x) => x.id === l.clipId) || l.clip
      return c ? `Clip : ${c.title} (${formatClock(c.startTimeSeconds)} à ${formatClock(c.endTimeSeconds)})` : `Clip n° ${l.clipId}`
    }
    const a = attachables.annotations.find((x) => x.id === l.annotationId) || l.annotation
    return a ? `Annotation : ${a.title} (${formatClock(a.startTimeSeconds)})` : `Annotation n° ${l.annotationId}`
  }

  return (
    <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
      <h2 className="font-display text-lg font-semibold">{section.label}</h2>

      {editable ? (
        <textarea
          aria-label={section.label}
          className="mt-3 min-h-28 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={10000}
        />
      ) : value ? (
        <p className="mt-3 whitespace-pre-wrap text-sm">{value}</p>
      ) : (
        <p className="mt-3 text-sm italic text-chalk-muted">Non renseigné.</p>
      )}

      {mine.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm">
          {mine.map((l, i) => (
            <li key={`${l.clipId || 'a'}-${l.annotationId || 'c'}-${i}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-chalk-muted">{describe(l)}</span>
                {!editable && l.clipId && (
                  <button type="button" onClick={() => onOpenClip(l.clipId)} className="text-mint-400 underline">
                    {openClip && openClip.id === l.clipId ? 'Masquer' : 'Voir le clip'}
                  </button>
                )}
                {editable && (
                  <button type="button" onClick={() => removeLink(l)} className="text-red-300 underline">
                    Retirer
                  </button>
                )}
              </div>
              {!editable && openClip && l.clipId && openClip.id === l.clipId && (
                <video src={openClip.url} controls playsInline className="mt-2 aspect-video w-full max-w-xl rounded-md bg-black" />
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (attachables.annotations.length > 0 || attachables.clips.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select aria-label={`Joindre un élément à : ${section.label}`} className={`${selectClass} max-w-md`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Joindre une annotation ou un clip...</option>
            {attachables.annotations.length > 0 && (
              <optgroup label="Annotations">
                {attachables.annotations.map((a) => (
                  <option key={`a${a.id}`} value={`a:${a.id}`}>
                    {formatClock(a.startTimeSeconds)} : {a.title} ({(CATEGORY_BY_VALUE[a.category] || {}).label || a.category})
                  </option>
                ))}
              </optgroup>
            )}
            {attachables.clips.length > 0 && (
              <optgroup label="Clips">
                {attachables.clips.map((c) => (
                  <option key={`c${c.id}`} value={`c:${c.id}`}>
                    {formatClock(c.startTimeSeconds)} : {c.title}
                    {c.status === 'pret' ? '' : ' (fichier non généré)'}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button type="button" onClick={addLink} disabled={!choice} className="rounded-md border border-pitch-600 px-3 py-2 text-sm hover:bg-pitch-700 disabled:opacity-50">
            Joindre
          </button>
        </div>
      )}
    </section>
  )
}
