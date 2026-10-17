import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMatches, useMatchData } from '../hooks/useMatches.js'
import { PERIODS, filterEvents, playerRows, availability } from '../utils/analytics.js'
import MatchSelect from '../components/stats/MatchSelect.jsx'
import PlayerTable from '../components/stats/PlayerTable.jsx'

const selectClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-800 px-3 py-2 text-sm'

export default function PlayerPerformance() {
  const [searchParams] = useSearchParams()
  const { matches, matchId, setMatchId, error } = useMatches(searchParams.get('match'))
  const data = useMatchData(matchId)

  const [side, setSide] = useState('')
  const [period, setPeriod] = useState('all')
  const [sort, setSort] = useState({ key: 'actions', dir: -1 })

  const events = data.status === 'ready' ? data.events : []
  const roster = data.status === 'ready' ? data.roster : null

  const periodEvents = useMemo(() => filterEvents(events, { period }), [events, period])
  const has = useMemo(() => availability(periodEvents), [periodEvents])
  const rows = useMemo(
    () => (roster ? playerRows(periodEvents, roster).filter((r) => !side || r.side === side) : []),
    [periodEvents, roster, side]
  )
  const unattributed = periodEvents.filter((e) => e.playerId === null && (!side || e.side === side)).length

  const handleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'name' ? 1 : -1 }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Performance des joueurs</h1>
        <p className="mt-2 max-w-prose text-chalk-muted">
          Statistiques individuelles calculées à partir des actions attribuées à chaque joueur dans les données importées.
        </p>
      </div>

      {matches === null && <p className="text-chalk-muted">Chargement...</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {matches !== null && matches.length === 0 && !error && (
        <p className="text-chalk-muted">
          Vous n'avez pas encore de match.{' '}
          <Link to="/matchs/nouveau" className="text-mint-400 underline">
            Créez-en un
          </Link>
          .
        </p>
      )}

      {matches !== null && matches.length > 0 && (
        <>
          <MatchSelect matches={matches} value={matchId} onChange={setMatchId} />

          {data.status === 'loading' && <p className="text-chalk-muted">Chargement des données...</p>}
          {data.status === 'error' && (
            <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {data.message}
            </p>
          )}

          {data.status === 'ready' && events.length === 0 && (
            <p className="text-chalk-muted">
              Aucune donnée pour ce match.{' '}
              <Link to={`/import?match=${matchId}`} className="text-mint-400 underline">
                Importez un fichier CSV
              </Link>
              .
            </p>
          )}

          {data.status === 'ready' && events.length > 0 && (
            <>
              <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium">Équipe</span>
                  <select className={selectClass} value={side} onChange={(e) => setSide(e.target.value)}>
                    <option value="">Les deux équipes</option>
                    <option value="home">{roster.home.name}</option>
                    <option value="away">{roster.away.name}</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Période</span>
                  <select className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value)}>
                    {PERIODS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {rows.length === 0 ? (
                <p className="text-chalk-muted">
                  Aucune action attribuée à un joueur pour ces filtres. Ajoutez une colonne « joueur » à votre fichier CSV.
                </p>
              ) : (
                <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
                  <PlayerTable rows={rows} has={has} matchId={matchId} sort={sort} onSort={handleSort} />
                  <p className="mt-3 text-xs text-chalk-muted">
                    « — » : pas de donnée (par exemple une précision sans aucune passe). Les minutes jouées ne sont pas
                    disponibles : les chiffres sont des totaux, pas des moyennes.
                    {unattributed > 0 &&
                      ` ${unattributed} actions sans joueur renseigné ne sont attribuées à personne.`}
                  </p>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
