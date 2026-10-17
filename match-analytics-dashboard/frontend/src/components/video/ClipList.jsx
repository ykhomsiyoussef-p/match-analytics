import { useState } from 'react'
import { CATEGORY_BY_VALUE } from '../../data/annotationCategories.js'
import { formatClock } from '../../utils/time.js'

const STATUS = {
  selection: { label: 'Sélection enregistrée', tone: 'text-chalk-muted' },
  traitement: { label: 'Traitement en cours...', tone: 'text-away' },
  pret: { label: 'Fichier prêt', tone: 'text-mint-300' },
  erreur: { label: 'Erreur de traitement', tone: 'text-red-300' },
}

const smallButton = 'rounded-md border border-pitch-600 px-3 py-1.5 text-sm hover:bg-pitch-700'

export default function ClipList({ clips, canEdit, onPreview, onEdit, onDelete, onRender, getPlaybackUrl }) {
  const [open, setOpen] = useState(null) // { id, url }
  const [openError, setOpenError] = useState('')

  const toggleClip = async (clip) => {
    setOpenError('')
    if (open && open.id === clip.id) return setOpen(null)
    try {
      const url = await getPlaybackUrl(clip)
      setOpen({ id: clip.id, url })
    } catch (err) {
      setOpenError(err.message)
    }
  }

  if (clips.length === 0) {
    return (
      <p className="text-sm text-chalk-muted">
        Aucun clip pour cette vidéo. Cliquez sur « Créer un clip », ou sur « Créer un clip » depuis une annotation.
      </p>
    )
  }

  return (
    <section>
      {openError && (
        <p role="alert" className="mb-3 rounded-md border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {openError}
        </p>
      )}
      <ul className="divide-y divide-pitch-600">
        {clips.map((clip) => {
          const status = STATUS[clip.status] || STATUS.selection
          const category = CATEGORY_BY_VALUE[clip.category]
          const isOpen = open && open.id === clip.id
          return (
            <li key={clip.id} className="space-y-2 py-3">
              <div>
                <p className="text-sm font-medium">{clip.title}</p>
                <p className="text-xs text-chalk-muted">
                  {formatClock(clip.startTimeSeconds)} à {formatClock(clip.endTimeSeconds)} (
                  {Math.round(clip.durationSeconds)} s), {category ? category.label : clip.category}
                  {clip.players.length > 0 ? `, ${clip.players.map((p) => p.fullName).join(', ')}` : ''}
                </p>
                <p className={`text-xs ${status.tone}`}>{status.label}</p>
                {clip.status === 'erreur' && clip.errorMessage && (
                  <p className="mt-1 text-xs text-red-300">{clip.errorMessage}</p>
                )}
                {clip.description && <p className="mt-1 line-clamp-2 text-sm">{clip.description}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onPreview(clip.startTimeSeconds, clip.endTimeSeconds)} className={smallButton}>
                  Prévisualiser
                </button>
                {clip.status === 'pret' && (
                  <button type="button" onClick={() => toggleClip(clip)} className={smallButton}>
                    {isOpen ? 'Masquer le clip' : 'Voir le clip'}
                  </button>
                )}
                {canEdit(clip) && (clip.status === 'selection' || clip.status === 'erreur') && (
                  <button
                    type="button"
                    onClick={() => onRender(clip)}
                    className="rounded-md bg-mint-400 px-3 py-1.5 text-sm font-semibold text-pitch-900 hover:bg-mint-300"
                  >
                    {clip.status === 'erreur' ? 'Relancer la génération' : 'Générer le fichier'}
                  </button>
                )}
                {canEdit(clip) && (
                  <>
                    <button type="button" onClick={() => onEdit(clip)} className="px-2 py-1.5 text-sm text-mint-400 underline">
                      Modifier
                    </button>
                    <button type="button" onClick={() => onDelete(clip)} className="px-2 py-1.5 text-sm text-red-300 underline">
                      Supprimer
                    </button>
                  </>
                )}
              </div>

              {isOpen && (
                <div className="space-y-2">
                  <video src={open.url} controls playsInline className="aspect-video w-full rounded-md bg-black" />
                  <a href={`${open.url}&download=1`} className="inline-block text-sm text-mint-400 underline">
                    Télécharger le clip
                  </a>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
