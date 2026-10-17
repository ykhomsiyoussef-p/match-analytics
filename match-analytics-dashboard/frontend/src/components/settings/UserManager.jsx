import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../api/client.js'

const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'analyste', label: 'Analyste vidéo' },
  { value: 'entraineur', label: 'Entraîneur' },
]
const inputClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm'

// Gestion des comptes (administrateur) : création, rôle, activation, réinitialisation du mot de passe.
export default function UserManager({ currentUserId }) {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ email: '', fullName: '', role: 'entraineur', password: '' })
  const [creating, setCreating] = useState(false)
  const [resetFor, setResetFor] = useState(null)
  const [resetPassword, setResetPassword] = useState('')

  useEffect(() => {
    api.get('/users').then(({ users: list }) => setUsers(list)).catch((err) => {
      setUsers([])
      setError(errorMessage(err))
    })
  }, [])

  const replace = (user) => setUsers((list) => list.map((u) => (u.id === user.id ? user : u)))

  const update = async (id, changes, success) => {
    setError('')
    setNotice('')
    try {
      const { user } = await api.patch(`/users/${id}`, changes)
      replace(user)
      if (success) setNotice(success)
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    }
  }

  const create = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    setNotice('')
    try {
      const { user } = await api.post('/users', form)
      setUsers((list) => [...list, user])
      setForm({ email: '', fullName: '', role: 'entraineur', password: '' })
      setNotice(`Compte créé pour ${user.fullName}. Transmettez-lui son mot de passe par un canal sûr.`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const submitReset = async (e) => {
    e.preventDefault()
    if (await update(resetFor, { password: resetPassword }, 'Mot de passe réinitialisé.')) {
      setResetFor(null)
      setResetPassword('')
    }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-mint-400/40 bg-mint-400/10 px-4 py-3 text-sm text-mint-300">{notice}</p>}

      {users === null && <p className="text-chalk-muted">Chargement...</p>}
      {users !== null && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-pitch-600 text-chalk-muted">
                <th scope="col" className="px-3 py-2 font-medium">Nom</th>
                <th scope="col" className="px-3 py-2 font-medium">Rôle</th>
                <th scope="col" className="px-3 py-2 font-medium">Compte</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === currentUserId
                return (
                  <tr key={u.id} className="border-b border-pitch-700 align-top">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {u.fullName}
                      <span className="block text-xs text-chalk-muted">{u.email}{isMe ? ' (vous)' : ''}</span>
                    </th>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Rôle de ${u.fullName}`}
                        className="rounded-md border border-pitch-600 bg-pitch-900 px-2 py-1.5 text-sm"
                        value={u.role}
                        disabled={isMe}
                        onChange={(e) => update(u.id, { role: e.target.value }, 'Rôle modifié.')}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">{u.isActive ? 'Actif' : <span className="text-away">Désactivé</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-3">
                        {!isMe && (
                          <button type="button" onClick={() => update(u.id, { isActive: !u.isActive }, u.isActive ? 'Compte désactivé.' : 'Compte réactivé.')} className="text-mint-400 underline">
                            {u.isActive ? 'Désactiver' : 'Réactiver'}
                          </button>
                        )}
                        <button type="button" onClick={() => { setResetFor(u.id); setResetPassword('') }} className="text-mint-400 underline">
                          Nouveau mot de passe
                        </button>
                      </div>
                      {resetFor === u.id && (
                        <form onSubmit={submitReset} className="mt-2 flex flex-wrap items-end gap-2">
                          <label className="block text-xs">
                            Nouveau mot de passe
                            <input type="password" className="mt-1 block rounded-md border border-pitch-600 bg-pitch-900 px-2 py-1.5 text-sm" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} minLength={10} autoComplete="new-password" required />
                          </label>
                          <button type="submit" className="rounded-md bg-mint-400 px-3 py-1.5 text-sm font-semibold text-pitch-900">Enregistrer</button>
                          <button type="button" onClick={() => setResetFor(null)} className="px-2 py-1.5 text-sm text-chalk-muted underline">Annuler</button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={create} className="max-w-xl space-y-4 rounded-lg border border-pitch-600 bg-pitch-900 p-5">
        <h3 className="font-display text-base font-semibold">Créer un compte</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Nom complet
            <input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} maxLength={100} required />
          </label>
          <label className="block text-sm">
            Adresse e-mail
            <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" required />
          </label>
          <label className="block text-sm">
            Rôle
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Mot de passe provisoire
            <input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={10} autoComplete="new-password" required />
          </label>
        </div>
        <p className="text-xs text-chalk-muted">
          Un entraîneur voit uniquement les rapports partagés avec lui, les statistiques des matchs concernés et les clips joints. Il ne voit jamais la vidéo complète.
        </p>
        <button type="submit" disabled={creating} className="rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60">
          {creating ? 'Création...' : 'Créer le compte'}
        </button>
      </form>
    </div>
  )
}
