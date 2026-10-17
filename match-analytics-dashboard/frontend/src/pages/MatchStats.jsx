import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMatches, useMatchData } from '../hooks/useMatches.js'
import { filterEvents, mirrorAway } from '../utils/analytics.js'
import MatchSelect from '../components/stats/MatchSelect.jsx'
import StatsFilters from '../components/stats/StatsFilters.jsx'
import TeamStatsTable from '../components/stats/TeamStatsTable.jsx'
import ShotMap from '../components/stats/ShotMap.jsx'
import PassMap from '../components/stats/PassMap.jsx'
import { HOME_COLOR, AWAY_COLOR } from '../components/stats/Pitch.jsx'

const panelClass = 'rounded-lg border border-pitch-600 bg-pitch-800 p-5'
const selectClass = 'mt-1 rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm'

const SHOT_FILTERS = [
  { value: '', label: 'Tous les tirs' },
  { value: 'goal', label: 'Buts' },
  { value: 'target', label: 'Tirs cadrés' },
  { value: 'off', label: 'Non cadrés, contrés ou poteau' },
]
const PASS_FILTERS = [
  { value: '', label: 'Toutes les passes' },
  { value: 'ok', label: 'Réussies' },
  { value: 'failed', label: 'Ratées' },
  { value: 'key', label: 'Passes clés' },
]

function TeamLegend({ roster }) {
  return (
    <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: HOME_COLOR }} aria-hidden="true" />
        {roster.home.name}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: AWAY_COLOR }} aria-hidden="true" />
        {roster.away.name}
      </span>
    </p>
  )
}

export default function MatchStats() {
  const [searchParams] = useSearchParams()
  const { matches, matchId, setMatchId, error } = useMatches(searchParams.get('match'))
  const data = useMatchData(matchId)

  const [filters, setFilters] = useState({ side: '', playerId: searchParams.get('player') || '', period: 'all' })
  const [mirror, setMirror] = useState(false)
  const [shotFilter, setShotFilter] = useState('')
  const [passFilter, setPassFilter] = useState('')

  const events = data.status === 'ready' ? data.events : []
  const roster = data.status === 'ready' ? data.roster : null

  // Au changement de match, les filtres de joueur et de période ne s'appliquent plus.
  useEffect(() => {
    setFilters((f) => ({ ...f, playerId: '', period: 'all' }))
  }, [matchId])

  const availablePeriods = useMemo(() => {
    const list = ['all']
    if (events.some((e) => e.period === 1)) list.push('1')
    if (events.some((e) => e.period === 2)) list.push('2')
    if (events.some((e) => e.period >= 3)) list.push('extra')
    return list
  }, [events])

  const periodEvents = useMemo(() => filterEvents(events, { period: filters.period }), [events, filters.period])

  const mapEvents = useMemo(() => {
    const list = filterEvents(events, filters)
    return mirror ? mirrorAway(list) : list
  }, [events, filters, mirror])

  const shots = useMemo(() => {
    let list = mapEvents.filter((e) => e.type === 'shot')
    if (shotFilter === 'goal') list = list.filter((e) => e.outcome === 'goal')
    if (shotFilter === 'target') list = list.filter((e) => e.onTarget)
    if (shotFilter === 'off') list = list.filter((e) => !e.onTarget)
    return list
  }, [mapEvents, shotFilter])

  const passes = useMemo(() => {
    let list = mapEvents.filter((e) => e.type === 'pass')
    if (passFilter === 'ok') list = list.filter((e) => e.passSuccess === true)
    if (passFilter === 'failed') list = list.filter((e) => e.passSuccess === false)
    if (passFilter === 'key') list = list.filter((e) => e.keyPass === true)
    return list
  }, [mapEvents, passFilter])

  const playerName = (id) => {
    if (!roster || id === null) return ''
    const all = [...roster.home.players, ...roster.away.players]
    const p = all.find((x) => x.id === id)
    return p ? p.fullName : ''
  }
  const teamNames = roster ? { home: roster.home.name, away: roster.away.name } : {}

  const shotsDrawn = shots.filter((s) => s.x !== null && s.y !== null).length
  const passesDrawn = passes.filter((p) => p.x !== null && p.endX !== null).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Statistiques du match</h1>
        <p className="mt-2 max-w-prose text-chalk-muted">
          Comparaison des équipes, carte des tirs et carte des passes, calculées uniquement à partir des données importées.
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
              </Link>{' '}
              pour voir les statistiques.
            </p>
          )}

          {data.status === 'ready' && events.length > 0 && (
            <>
              {data.truncated && (
                <p className="rounded-md border border-away/40 bg-away/10 px-4 py-2.5 text-sm text-away">
                  Ce match contient plus de 20 000 événements : seuls les 20 000 premiers sont pris en compte.
                </p>
              )}

              <StatsFilters
                roster={roster}
                filters={filters}
                onChange={setFilters}
                availablePeriods={availablePeriods}
                mirror={mirror}
                onMirror={setMirror}
              />

              <section className={panelClass}>
                <h2 className="font-display text-lg font-semibold">Comparaison des équipes</h2>
                <p className="mb-3 mt-1 text-sm text-chalk-muted">
                  Selon la période choisie. Les filtres d'équipe et de joueur s'appliquent aux cartes.
                </p>
                <TeamStatsTable events={periodEvents} roster={roster} />
              </section>

              <section className={panelClass}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Carte des tirs</h2>
                    <p className="mt-1 text-sm text-chalk-muted">
                      Plein : cadré (anneau blanc : but). Vide : non cadré, contré ou poteau. La taille reflète le xG,
                      quand il est fourni. Survolez un tir pour le détail.
                    </p>
                  </div>
                  <label className="block text-sm">
                    <span className="text-chalk-muted">Afficher</span>
                    <select className={`${selectClass} block`} value={shotFilter} onChange={(e) => setShotFilter(e.target.value)}>
                      {SHOT_FILTERS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-4">
                  <TeamLegend roster={roster} />
                </div>
                <div className="mt-3">
                  <ShotMap shots={shots} teamNames={teamNames} playerName={playerName} />
                </div>
                <p className="mt-3 text-sm text-chalk-muted">
                  {shots.length} tirs, dont {shotsDrawn} avec coordonnées affichés sur la carte.
                  {shots.length > shotsDrawn && ' Les tirs sans coordonnées ne peuvent pas être placés.'}
                </p>
              </section>

              <section className={panelClass}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Carte des passes</h2>
                    <p className="mt-1 text-sm text-chalk-muted">
                      Trait plein : passe réussie. Pointillés : passe ratée. Trait épais avec point : passe clé.
                      Filtrez par équipe ou par joueur pour une carte lisible.
                    </p>
                  </div>
                  <label className="block text-sm">
                    <span className="text-chalk-muted">Afficher</span>
                    <select className={`${selectClass} block`} value={passFilter} onChange={(e) => setPassFilter(e.target.value)}>
                      {PASS_FILTERS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-4">
                  <TeamLegend roster={roster} />
                </div>
                <div className="mt-3">
                  <PassMap passes={passes} teamNames={teamNames} playerName={playerName} />
                </div>
                <p className="mt-3 text-sm text-chalk-muted">
                  {passes.length} passes, dont {passesDrawn} avec points de départ et d'arrivée affichées sur la carte.
                  {passes.length > passesDrawn && ' Les autres n\'ont pas de coordonnées complètes.'}
                </p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
