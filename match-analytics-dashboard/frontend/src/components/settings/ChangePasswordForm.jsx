import { useState } from 'react'
import { api, errorMessage, tokenStore } from '../../api/client.js'

const inputClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm'

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (next !== confirm) return setError('La confirmation ne correspond pas au nouveau mot de passe.')
    setBusy(true)
    try {
      const { token } = await api.post('/auth/change-password', { currentPassword: current, newPassword: next })
      tokenStore.set(token) // les autres sessions sont déconnectées, celle-ci reste ouverte
      setCurrent('')
      setNext('')
      setConfirm('')
      setNotice('Mot de passe modifié. Vos autres sessions ont été déconnectées.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <label className="block text-sm">
        Mot de passe actuel
        <input type="password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label className="block text-sm">
        Nouveau mot de passe (10 caractères minimum)
        <input type="password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} required />
      </label>
      <label className="block text-sm">
        Confirmer le nouveau mot de passe
        <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-mint-300">{notice}</p>}
      <button type="submit" disabled={busy} className="rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60">
        {busy ? 'Modification...' : 'Changer le mot de passe'}
      </button>
    </form>
  )
}
