import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api/client.js'
import { REPORT_SECTIONS } from '../data/reportSections.js'
import StatusChip from '../components/reports/StatusChip.jsx'
import ReportSection from '../components/reports/ReportSection.jsx'
import SharePanel from '../components/reports/SharePanel.jsx'
import CommentPanel from '../components/reports/CommentPanel.jsx'

const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const toLink = (l) => ({
  section: l.section,
  annotationId: l.annotation ? l.annotation.id : null,
  clipId: l.clip ? l.clip.id : null,
  annotation: l.annotation,
  clip: l.clip,
})

// Actions du cycle de vie, affichées selon les droits renvoyés par le serveur.
const ACTIONS = [
  { action: 'submit', permission: 'canSubmit', label: 'Soumettre pour validation', primary: true },
  { action: 'validate', permission: 'canValidate', label: 'Valider le rapport', primary: true },
  { action: 'reject', permission: 'canReject', label: 'Renvoyer en brouillon' },
  { action: 'share', permission: 'canShare', label: 'Partager le rapport', primary: true },
  { action: 'unshare', permission: 'canUnshare', label: 'Retirer le partage' },
  { action: 'reopen', permission: 'canReopen', label: 'Rouvrir en brouillon' },
]

export default function ReportDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [form, setForm] = useState({})
  const [links, setLinks] = useState([])
  const [attachables, setAttachables] = useState({ annotations: [], clips: [] })
  const [openClip, setOpenClip] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const apply = (d) => {
    setData(d)
    setForm(Object.fromEntries(REPORT_SECTIONS.map((s) => [s.field, d.report[s.field] || ''])))
    setLinks(d.links.map(toLink))
    setDirty(false)
  }

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    api
      .get(`/reports/${id}`)
      .then((d) => !cancelled && apply(d))
      .catch((err) => !cancelled && setError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [id])

  const canEdit = data ? data.permissions.canEdit : false
  useEffect(() => {
    if (!canEdit) return
    api.get(`/reports/${id}/attachables`).then(setAttachables).catch(() => {})
  }, [id, canEdit])

  if (error && !data) {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>
        <Link to="/rapports" className="text-mint-400 underline">Retour aux rapports</Link>
      </div>
    )
  }
  if (!data) return <p className="text-chalk-muted">Chargement du rapport...</p>

  const { report, match, permissions: perms } = data

  const run = async (fn, success) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      if (success) setNotice(success)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      const body = {
        ...Object.fromEntries(REPORT_SECTIONS.map((s) => [s.field, form[s.field] || null])),
        links: links.map((l) => ({ section: l.section, annotationId: l.annotationId, clipId: l.clipId })),
      }
      apply(await api.put(`/reports/${id}`, body))
    }, 'Rapport enregistré.')

  const transition = (action) => run(async () => apply(await api.post(`/reports/${id}/transition`, { action })), 'Statut mis à jour.')

  const downloadPdf = () => run(() => api.download(`/reports/${id}/pdf`, `rapport-${id}.pdf`))

  const toggleClip = (clipId) =>
    run(async () => {
      if (openClip && openClip.id === clipId) return setOpenClip(null)
      const { url } = await api.get(`/reports/${id}/clips/${clipId}/playback`)
      setOpenClip({ id: clipId, url })
    })

  const setField = (field) => (value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setDirty(true)
  }

  return (
    <div className="space-y-6">
      <Link to="/rapports" className="text-sm text-mint-400 underline">Tous les rapports</Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold">
            {match.home.name} {match.homeScore} : {match.awayScore} {match.away.name}
          </h1>
          <StatusChip status={report.status} />
        </div>
        <p className="text-sm text-chalk-muted">
          {match.competition ? `${match.competition}, ` : ''}{formatDate(match.matchDate)}. Rapport de {report.authorName}.
          {report.validatedAt ? ` Validé le ${formatDate(report.validatedAt)}${report.validatedByName ? ` par ${report.validatedByName}` : ''}.` : ''}
          {report.sharedAt ? ` Partagé le ${formatDate(report.sharedAt)}.` : ''}
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link to={`/matchs/${match.id}`} className="text-mint-400 underline">Tableau de bord du match</Link>
          <Link to={`/statistiques?match=${match.id}`} className="text-mint-400 underline">Statistiques du match</Link>
        </div>
      </header>

      {error && <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-mint-400/40 bg-mint-400/10 px-4 py-3 text-sm text-mint-300">{notice}</p>}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-pitch-600 bg-pitch-800 p-4">
        {perms.canEdit && (
          <button type="button" onClick={save} disabled={busy || !dirty} className="rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-50">
            {busy ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        )}
        {ACTIONS.filter((a) => perms[a.permission]).map((a) => (
          <button
            key={a.action}
            type="button"
            onClick={() => transition(a.action)}
            disabled={busy || dirty}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${a.primary ? 'border border-mint-400 text-mint-300 hover:bg-mint-400/10' : 'border border-pitch-600 hover:bg-pitch-700'}`}
          >
            {a.label}
          </button>
        ))}
        <button type="button" onClick={downloadPdf} disabled={busy} className="rounded-md border border-pitch-600 px-4 py-2 text-sm font-medium hover:bg-pitch-700 disabled:opacity-50">
          Télécharger le PDF
        </button>
        {dirty && <span className="text-sm text-away">Modifications non enregistrées : enregistrez avant de changer le statut.</span>}
      </div>

      {perms.canEdit && report.status === 'en_validation' && (
        <p className="text-sm text-chalk-muted">Ce rapport est en cours de validation : il reste modifiable jusqu'à sa validation.</p>
      )}
      {!perms.canEdit && perms.isManager && (
        <p className="text-sm text-chalk-muted">Ce rapport n'est plus modifiable. Utilisez « Rouvrir en brouillon » pour le modifier.</p>
      )}

      <div className="space-y-4">
        {REPORT_SECTIONS.map((section) => (
          <ReportSection
            key={section.field}
            section={section}
            value={form[section.field] || ''}
            onChange={setField(section.field)}
            links={links}
            onLinksChange={(next) => {
              setLinks(next)
              setDirty(true)
            }}
            editable={perms.canEdit}
            attachables={attachables}
            onOpenClip={toggleClip}
            openClip={openClip}
          />
        ))}
      </div>

      {perms.canManageShares && <SharePanel reportId={id} shares={data.shares} status={report.status} onSaved={apply} />}
      <CommentPanel reportId={id} comments={data.comments} canComment={perms.canComment} onSaved={apply} />
    </div>
  )
}
