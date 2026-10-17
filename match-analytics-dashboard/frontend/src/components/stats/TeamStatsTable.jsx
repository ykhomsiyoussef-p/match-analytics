import { computeStats, availability } from '../../utils/analytics.js'

const ROWS = [
  { key: 'shots', label: 'Tirs', need: 'shots' },
  { key: 'shotsOnTarget', label: 'Tirs cadrés', need: 'shots' },
  { key: 'goals', label: 'Buts', need: 'shots' },
  { key: 'xg', label: 'xG', need: 'xg' },
  { key: 'passes', label: 'Passes', need: 'passes' },
  { key: 'passesOk', label: 'Passes réussies', need: 'passes' },
  { key: 'passAccuracy', label: 'Précision des passes', need: 'passes', suffix: '%' },
  { key: 'keyPasses', label: 'Passes clés', need: 'passes' },
  { key: 'corners', label: 'Corners', need: 'corners' },
  { key: 'interceptions', label: 'Interceptions', need: 'interceptions' },
  { key: 'duels', label: 'Duels', need: 'duels' },
  { key: 'duelsWon', label: 'Duels gagnés', need: 'duels' },
]

const show = (value, suffix = '') => (value === null || value === undefined ? '—' : `${value}${suffix}`)

// Comparaison des deux équipes. Une statistique sans donnée dans le fichier importé s'affiche « — ».
export default function TeamStatsTable({ events, roster }) {
  const home = computeStats(events.filter((e) => e.side === 'home'))
  const away = computeStats(events.filter((e) => e.side === 'away'))
  const has = availability(events)
  const partialXg = has.xg && (home.xgShots < home.shots || away.xgShots < away.shots)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-pitch-600">
              <th scope="col" className="px-3 py-2 font-medium text-chalk-muted">
                Statistique
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-mint-400">
                {roster.home.name}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold text-away">
                {roster.away.name}
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const ok = has[row.need]
              return (
                <tr key={row.key} className="border-b border-pitch-700">
                  <th scope="row" className="px-3 py-2 font-normal">
                    {row.label}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{ok ? show(home[row.key], row.suffix) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ok ? show(away[row.key], row.suffix) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-chalk-muted">
        « — » : aucune donnée de ce type dans les fichiers importés. La possession n'est pas calculée, car aucune source ne la fournit.
        {partialXg &&
          ` Le xG n'est fourni que pour ${home.xgShots + away.xgShots} tirs sur ${home.shots + away.shots} : il est partiel.`}
      </p>
    </div>
  )
}
