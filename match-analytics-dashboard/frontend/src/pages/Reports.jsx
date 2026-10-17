import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import StatusChip from '../components/reports/StatusChip.jsx'

const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Reports() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canWrite = user.role === 'admin' || user.role === 'analyste'
  const [reports, setReports] = useState(null)
  const [matches, setMatches] = useState([])
  const [matchId, setMatchId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/reports').then(({ reports: list }) => setReports(list)).catch((err) => {
      setReports([])
      setError(errorMessage(err))
    })
    if (canWrite) {
      api
        .get('/matches')
        .then(({ matches: list }) => {
          const own = list.filter((m) => m.access === 'full')
          setMatches(own)
          setMatchId((current) => current || (own[0] ? String(own[0].id) : ''))
        })
        .catch(() => {})
    }
  }, [canWrite])

  const create = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api.post('/reports', { matchId: Number(matchId) })
      navigate(`/rapports/${data.report.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Rapports</h1>
        <p className="mt-2 max-w-prose text-chalk-muted">
          {canWrite
            ? "Rédigez le feedback de l'analyste, faites-le valider, puis partagez-le avec les personnes de votre choix. Chaque rapport se télécharge en PDF."
            : "Rapports d'analyse partagés avec vous : résumé, points forts, recommandations, clips et statistiques."}
        </p>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {canWrite && matches.length > 0 && (
        <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
          <h2 className="font-display text-lg font-semibold">Nouveau rapport</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="text-chalk-muted">Match</span>
              <select className="mt-1 block rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.home.name} contre {m.away.name}, {m.matchDate}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={create} disabled={busy || !matchId} className="rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60">
              {busy ? 'Création...' : 'Créer le rapport'}
            </button>
          </div>
        </section>
      )}

      {reports === null && <p className="text-chalk-muted">Chargement...</p>}
      {reports !== null && reports.length === 0 && !error && (
        <p className="text-chalk-muted">{canWrite ? "Aucun rapport pour le moment." : "Aucun rapport n'a encore été partagé avec vous."}</p>
      )}

      {reports !== null && reports.length > 0 && (
        <ul className="divide-y divide-pitch-600 rounded-lg border border-pitch-600 bg-pitch-800">
          {reports.map((r) => (
            <li key={r.id}>
              <Link to={`/rapports/${r.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-pitch-700">
                <span className="font-display text-lg font-semibold">
                  {r.home.name} <span className="tabular-nums">{r.homeScore} : {r.awayScore}</span> {r.away.name}
                </span>
                <StatusChip status={r.status} />
                <span className="text-sm text-chalk-muted">
                  Match du {formatDate(r.matchDate)}. Par {r.authorName}{r.isAuthor ? ' (vous)' : ''}. Modifié le {formatDate(r.updatedAt)}.
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
