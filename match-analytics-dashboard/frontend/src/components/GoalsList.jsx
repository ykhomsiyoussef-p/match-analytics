export default function GoalsList({ goals, home, away }) {
  if (goals.length === 0) {
    return <p className="py-3 text-sm text-chalk-muted">Aucun but enregistré pour ce match.</p>
  }

  return (
    <ul className="divide-y divide-pitch-600">
      {goals.map((goal, i) => {
        const team = goal.team === 'home' ? home : away
        const color = goal.team === 'home' ? 'bg-mint-400' : 'bg-away'
        return (
          <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="w-10 font-semibold tabular-nums">{goal.minute}'</span>
            <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
            <span>{goal.player || 'Joueur non renseigné'}</span>
            <span className="ml-auto text-chalk-muted">{team.name}</span>
          </li>
        )
      })}
    </ul>
  )
}
