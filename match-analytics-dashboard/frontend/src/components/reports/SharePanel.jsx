import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../api/client.js'

const ROLE_LABEL = { admin: 'Administrateur', analyste: 'Analyste vidéo', entraineur: 'Entraîneur' }

// Choix des destinataires d'un rapport validé, et du droit de commenter.
export default function SharePanel({ reportId, shares, status, onSaved }) {
  const [recipients, setRecipients] = useState([])
  const [selected, setSelected] = useState(() => new Map(shares.map((s) => [s.userId, s.canComment])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.get('/users/recipients').then(({ users }) => setRecipients(users)).catch((err) => setError(errorMessage(err)))
  }, [])
  useEffect(() => {
    setSelected(new Map(shares.map((s) => [s.userId, s.canComment])))
  }, [shares])

  const toggle = (id) =>
    setSelected((m) => {
      const next = new Map(m)
      if (next.has(id)) next.delete(id)
      else next.set(id, false)
      return next
    })
  const toggleComment = (id) => setSelected((m) => new Map(m).set(id, !m.get(id)))

  const save = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = { shares: [...selected.entries()].map(([userId, canComment]) => ({ userId, canComment })) }
      const data = await api.put(`/reports/${reportId}/shares`, body)
      onSaved(data)
      setNotice('Destinataires enregistrés.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
      <h2 className="font-display text-lg font-semibold">Destinataires</h2>
      <p className="mt-1 text-sm text-chalk-muted">
        {status === 'partage'
          ? 'Ces personnes voient ce rapport, ses statistiques et les clips joints. Elles ne voient jamais la vidéo complète.'
          : 'Choisissez qui verra le rapport, puis cliquez sur « Partager » : tant qu\'il n\'est pas partagé, personne d\'autre ne le voit.'}
      </p>

      {recipients.length === 0 ? (
        <p className="mt-3 text-sm text-chalk-muted">Aucun autre compte. L'administrateur peut en créer dans « Paramètres ».</p>
      ) : (
        <ul className="mt-3 divide-y divide-pitch-600">
          {recipients.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                <span>
                  {u.fullName} <span className="text-chalk-muted">({ROLE_LABEL[u.role]}, {u.email})</span>
                </span>
              </label>
              {selected.has(u.id) && (
                <label className="flex items-center gap-2 text-chalk-muted">
                  <input type="checkbox" checked={selected.get(u.id)} onChange={() => toggleComment(u.id)} />
                  Peut commenter
                </label>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-mint-300">{notice}</p>}
      <button type="button" onClick={save} disabled={busy} className="mt-4 rounded-md border border-pitch-600 px-4 py-2 text-sm font-medium hover:bg-pitch-700 disabled:opacity-60">
        {busy ? 'Enregistrement...' : 'Enregistrer les destinataires'}
      </button>
    </section>
  )
}
