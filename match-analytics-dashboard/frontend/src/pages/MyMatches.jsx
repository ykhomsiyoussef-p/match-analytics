import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function MyMatches() {
  const { user } = useAuth()
  const canCreate = user.role === 'admin' || user.role === 'analyste'
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    api
      .get('/matches')
      .then(({ matches }) => setState({ status: 'ready', matches }))
      .catch((err) => setState({ status: 'error', message: err.message }))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">Mes matchs</h1>
        {canCreate && (
          <Link
            to="/matchs/nouveau"
            className="rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300"
          >
            Nouveau match
          </Link>
        )}
      </div>

      {state.status === 'loading' && <p className="mt-6 text-chalk-muted">Chargement...</p>}

      {state.status === 'error' && (
        <p className="mt-6 rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {state.message}
        </p>
      )}

      {state.status === 'ready' && state.matches.length === 0 && (
        <p className="mt-6 text-chalk-muted">{canCreate ? 'Aucun match pour le moment. Créez votre premier match pour commencer.' : "Aucun match n'a encore été partagé avec vous."}</p>
      )}

      {state.status === 'ready' && state.matches.length > 0 && (
        <ul className="mt-6 divide-y divide-pitch-600 rounded-lg border border-pitch-600 bg-pitch-800">
          {state.matches.map((m) => (
            <li key={m.id}>
              <Link
                to={`/matchs/${m.id}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-pitch-700"
              >
                <span className="font-display text-lg font-semibold">
                  {m.home.name} <span className="tabular-nums">{m.homeScore} : {m.awayScore}</span> {m.away.name}
                </span>
                <span className="text-sm text-chalk-muted">
                  {m.competition ? `${m.competition}, ` : ''}
                  {formatDate(m.matchDate)}
                </span>
                {m.access === 'shared' && (
                  <span className="rounded-full border border-mint-400/40 px-2 py-0.5 text-xs text-mint-300">Partagé avec vous</span>
                )}
                {m.isDemo && (
                  <span className="rounded-full border border-away/40 px-2 py-0.5 text-xs text-away">Démonstration</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
