import { PERIODS } from '../../utils/analytics.js'

const selectClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-800 px-3 py-2 text-sm'

// Filtres des cartes : équipe, joueur, période. Les périodes sans événement ne sont pas proposées.
export default function StatsFilters({ roster, filters, onChange, availablePeriods, mirror, onMirror }) {
  const set = (field) => (e) => onChange({ ...filters, [field]: e.target.value })
  const setSide = (e) => onChange({ ...filters, side: e.target.value, playerId: '' })

  const groups = filters.side
    ? [roster[filters.side]]
    : [roster.home, roster.away]

  return (
    <div className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium">Équipe</span>
          <select className={selectClass} value={filters.side} onChange={setSide}>
            <option value="">Les deux équipes</option>
            <option value="home">{roster.home.name}</option>
            <option value="away">{roster.away.name}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Joueur</span>
          <select className={selectClass} value={filters.playerId} onChange={set('playerId')}>
            <option value="">Tous les joueurs</option>
            {groups.map((team) => (
              <optgroup key={team.id} label={team.name}>
                {team.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shirtNumber != null ? `${p.shirtNumber}. ` : ''}
                    {p.fullName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Période</span>
          <select className={selectClass} value={filters.period} onChange={set('period')}>
            {PERIODS.filter((p) => availablePeriods.includes(p.value)).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={mirror} onChange={(e) => onMirror(e.target.checked)} />
        <span>
          Placer l'équipe extérieure face à l'autre but
          <span className="block text-xs text-chalk-muted">
            À cocher si votre fichier fait attaquer les deux équipes vers la même droite (cas de nombreux fournisseurs de
            données) : les actions de l'équipe extérieure sont alors retournées.
          </span>
        </span>
      </label>
    </div>
  )
}
