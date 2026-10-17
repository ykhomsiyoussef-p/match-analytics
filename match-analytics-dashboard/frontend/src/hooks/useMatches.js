import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api/client.js'

// Liste des matchs accessibles + match sélectionné (le plus récent par défaut).
export function useMatches(initialId) {
  const [matches, setMatches] = useState(null)
  const [matchId, setMatchId] = useState(initialId || '')
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/matches')
      .then(({ matches: list }) => {
        setMatches(list)
        setMatchId((current) => current || (list[0] ? String(list[0].id) : ''))
      })
      .catch((err) => {
        setMatches([])
        setError(errorMessage(err))
      })
  }, [])

  return { matches, matchId, setMatchId, error }
}

// Événements détaillés + effectif d'un match.
export function useMatchData(matchId) {
  const [state, setState] = useState({ status: 'idle' })

  useEffect(() => {
    if (!matchId) {
      setState({ status: 'idle' })
      return undefined
    }
    let cancelled = false
    setState({ status: 'loading' })
    Promise.all([api.get(`/matches/${matchId}/dataset`), api.get(`/matches/${matchId}/roster`)])
      .then(([data, r]) => {
        if (cancelled) return
        setState({ status: 'ready', match: data.match, events: data.events, truncated: data.truncated, roster: r.roster })
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [matchId])

  return state
}
