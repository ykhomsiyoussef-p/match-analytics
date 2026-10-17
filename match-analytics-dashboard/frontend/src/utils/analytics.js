// Calculs statistiques à partir des événements du match.
// Règle : une statistique sans donnée source vaut null (affichée « — »), jamais 0 inventé.

export const PERIODS = [
  { value: 'all', label: 'Match entier' },
  { value: '1', label: '1re mi-temps' },
  { value: '2', label: '2e mi-temps' },
  { value: 'extra', label: 'Prolongations' },
]

export function filterEvents(events, { side = '', playerId = '', period = 'all', type = '' } = {}) {
  return events.filter(
    (e) =>
      (!side || e.side === side) &&
      (!playerId || e.playerId === Number(playerId)) &&
      (period === 'all' || (period === 'extra' ? e.period >= 3 : e.period === Number(period))) &&
      (!type || e.type === type)
  )
}

// Certains fournisseurs de données font attaquer les deux équipes dans le même sens.
// Ce miroir (x et y inversés) place l'équipe extérieure face à l'autre but.
export function mirrorAway(events) {
  const flip = (v) => (v === null ? null : Math.round((100 - v) * 100) / 100)
  return events.map((e) =>
    e.side === 'away' ? { ...e, x: flip(e.x), y: flip(e.y), endX: flip(e.endX), endY: flip(e.endY) } : e
  )
}

const round2 = (n) => Math.round(n * 100) / 100
const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : null)

// Statistiques d'un ensemble d'événements (une équipe ou un joueur).
export function computeStats(events) {
  const shots = events.filter((e) => e.type === 'shot')
  const passes = events.filter((e) => e.type === 'pass')
  const duels = events.filter((e) => e.type === 'duel')
  const shotsWithXg = shots.filter((e) => e.xg !== null)
  const passesOk = passes.filter((e) => e.passSuccess).length

  return {
    actions: events.length,
    shots: shots.length,
    shotsOnTarget: shots.filter((e) => e.onTarget).length,
    goals: shots.filter((e) => e.outcome === 'goal').length,
    xg: shotsWithXg.length > 0 ? round2(shotsWithXg.reduce((sum, e) => sum + e.xg, 0)) : null,
    xgShots: shotsWithXg.length,
    passes: passes.length,
    passesOk,
    passAccuracy: percent(passesOk, passes.length),
    keyPasses: passes.filter((e) => e.keyPass).length,
    corners: events.filter((e) => e.type === 'corner').length,
    interceptions: events.filter((e) => e.type === 'interception').length,
    duels: duels.length,
    duelsWon: duels.filter((e) => e.outcome === 'won').length,
  }
}

// Quelles catégories existent dans les données ? (pour afficher « — » plutôt qu'un faux zéro)
export function availability(events) {
  const has = (type) => events.some((e) => e.type === type)
  return {
    shots: has('shot'),
    passes: has('pass'),
    corners: has('corner'),
    interceptions: has('interception'),
    duels: has('duel'),
    xg: events.some((e) => e.type === 'shot' && e.xg !== null),
    keyPasses: events.some((e) => e.type === 'pass' && e.keyPass !== null && e.keyPass !== undefined),
  }
}

// Une ligne par joueur ayant au moins une action attribuée.
export function playerRows(events, roster) {
  const players = new Map()
  for (const side of ['home', 'away']) {
    for (const p of roster[side].players) {
      players.set(p.id, { id: p.id, name: p.fullName, shirtNumber: p.shirtNumber, side, teamName: roster[side].name })
    }
  }
  const byPlayer = new Map()
  for (const e of events) {
    if (e.playerId === null || !players.has(e.playerId)) continue
    if (!byPlayer.has(e.playerId)) byPlayer.set(e.playerId, [])
    byPlayer.get(e.playerId).push(e)
  }
  return [...byPlayer.entries()].map(([id, list]) => ({ ...players.get(id), ...computeStats(list) }))
}
