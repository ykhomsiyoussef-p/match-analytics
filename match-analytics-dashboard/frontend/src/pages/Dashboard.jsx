import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { STAT_DEFINITIONS } from '../data/statDefinitions.js'
import DemoBanner from '../components/DemoBanner.jsx'
import MatchHeader from '../components/MatchHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatDuel from '../components/StatDuel.jsx'
import GoalsList from '../components/GoalsList.jsx'
import StatsBarChart from '../charts/StatsBarChart.jsx'

const CARD_KEYS = ['shots', 'shotsOnTarget', 'xg', 'passAccuracy']
const CHART_KEYS = ['shots', 'shotsOnTarget', 'corners', 'interceptions']
const DUEL_KEYS = ['possession', 'passAccuracy', 'duelsWon']

export default function Dashboard() {
  const { id } = useParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    async function load() {
      try {
        let matchId = id
        if (!matchId) {
          // Sans identifiant dans l'URL : on affiche le match le plus récent.
          const { matches } = await api.get('/matches')
          if (matches.length === 0) {
            if (!cancelled) setState({ status: 'empty' })
            return
          }
          matchId = matches[0].id
        }
        const data = await api.get(`/matches/${matchId}/dashboard`)
        if (!cancelled) setState({ status: 'ready', data })
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: err.message })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (state.status === 'loading') {
    return <p className="text-chalk-muted">Chargement du match...</p>
  }

  if (state.status === 'error') {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold">Tableau de bord</h1>
        <p className="mt-4 rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {state.message}
        </p>
      </div>
    )
  }

  if (state.status === 'empty') {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold">Tableau de bord</h1>
        <p className="mt-2 text-chalk-muted">Vous n'avez pas encore de match.</p>
        <Link
          to="/matchs/nouveau"
          className="mt-6 inline-block rounded-md bg-mint-400 px-4 py-2.5 font-semibold text-pitch-900 hover:bg-mint-300"
        >
          Créer un match
        </Link>
      </div>
    )
  }

  const { match, stats, goals } = state.data
  const { home, away } = match

  const chartData = CHART_KEYS.filter((k) => stats[k]).map((k) => ({
    name: STAT_DEFINITIONS[k].label,
    home: stats[k].home,
    away: stats[k].away,
  }))
  const duelKeys = DUEL_KEYS.filter((k) => stats[k])

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Tableau de bord</h1>
      {match.isDemo && <DemoBanner />}
      <MatchHeader match={match} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARD_KEYS.map((k) => (
          <StatCard
            key={k}
            label={STAT_DEFINITIONS[k].label}
            value={stats[k]}
            suffix={STAT_DEFINITIONS[k].suffix}
            homeName={home.name}
            awayName={away.name}
          />
        ))}
      </div>

      {(chartData.length > 0 || duelKeys.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {chartData.length > 0 && (
            <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5 lg:col-span-3">
              <h2 className="font-display text-lg font-semibold">Comparaison des équipes</h2>
              <div className="mt-4">
                <StatsBarChart data={chartData} homeName={home.name} awayName={away.name} />
              </div>
            </section>
          )}
          {duelKeys.length > 0 && (
            <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5 lg:col-span-2">
              <h2 className="font-display text-lg font-semibold">Équilibre du match</h2>
              <div className="mt-5 space-y-5">
                {duelKeys.map((k) => (
                  <StatDuel
                    key={k}
                    label={STAT_DEFINITIONS[k].label}
                    home={stats[k].home}
                    away={stats[k].away}
                    suffix={STAT_DEFINITIONS[k].suffix}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
        <h2 className="font-display text-lg font-semibold">Buts</h2>
        <div className="mt-2">
          <GoalsList goals={goals} home={home} away={away} />
        </div>
      </section>
    </div>
  )
}
