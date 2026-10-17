import { useState } from 'react'
import { api, errorMessage } from '../../api/client.js'

const ROLE_LABEL = { admin: 'Administrateur', analyste: 'Analyste vidéo', entraineur: 'Entraîneur' }
const formatDate = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export default function CommentPanel({ reportId, comments, canComment, onSaved }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api.post(`/reports/${reportId}/comments`, { body })
      onSaved(data)
      setBody('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (comments.length === 0 && !canComment) return null

  return (
    <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
      <h2 className="font-display text-lg font-semibold">Commentaires ({comments.length})</h2>
      {comments.length === 0 && <p className="mt-3 text-sm text-chalk-muted">Aucun commentaire pour le moment.</p>}
      <ul className="mt-3 divide-y divide-pitch-600">
        {comments.map((c) => (
          <li key={c.id} className="py-3 text-sm">
            <p className="font-medium">
              {c.authorName} <span className="font-normal text-chalk-muted">({ROLE_LABEL[c.authorRole]}), {formatDate(c.createdAt)}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
      {canComment && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            Ajouter un commentaire
            <textarea className="mt-1 min-h-20 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required />
          </label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={busy || !body.trim()} className="rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60">
            {busy ? 'Envoi...' : 'Commenter'}
          </button>
        </form>
      )}
    </section>
  )
}
