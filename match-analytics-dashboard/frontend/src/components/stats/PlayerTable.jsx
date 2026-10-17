import { Link } from 'react-router-dom'

const show = (value, suffix = '') => (value === null || value === undefined ? '—' : `${value}${suffix}`)

// Colonnes : une colonne n'est affichée que si ce type de donnée existe dans le match.
function buildColumns(has) {
  const columns = [{ key: 'actions', label: 'Actions' }]
  if (has.shots) {
    columns.push({ key: 'shots', label: 'Tirs' }, { key: 'goals', label: 'Buts' })
    if (has.xg) columns.push({ key: 'xg', label: 'xG' })
  }
  if (has.passes) {
    columns.push(
      { key: 'passes', label: 'Passes' },
      { key: 'passAccuracy', label: 'Précision', suffix: '%' },
      { key: 'keyPasses', label: 'Passes clés' }
    )
  }
  if (has.interceptions) columns.push({ key: 'interceptions', label: 'Interceptions' })
  if (has.duels) columns.push({ key: 'duelsWon', label: 'Duels gagnés', total: 'duels' })
  if (has.corners) columns.push({ key: 'corners', label: 'Corners' })
  return columns
}

// Tableau triable : un clic sur un en-tête trie la colonne (puis inverse l'ordre).
export default function PlayerTable({ rows, has, matchId, sort, onSort }) {
  const columns = buildColumns(has)

  const sorted = [...rows].sort((a, b) => {
    if (sort.key === 'name') return sort.dir * a.name.localeCompare(b.name, 'fr')
    const av = a[sort.key]
    const bv = b[sort.key]
    // Les valeurs absentes (null) vont toujours en bas, quel que soit le sens du tri.
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return sort.dir * (av - bv)
  })

  const ariaSort = (key) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none')

  const header = (key, label, align) => (
    <th key={key} scope="col" aria-sort={ariaSort(key)} className={`px-3 py-2 font-medium ${align}`}>
      <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1 hover:text-mint-300">
        {label}
        {sort.key === key && <span aria-hidden="true">{sort.dir === 1 ? '▲' : '▼'}</span>}
      </button>
    </th>
  )

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-pitch-600 text-chalk-muted">
            {header('name', 'Joueur', 'text-left')}
            <th scope="col" className="px-3 py-2 font-medium">
              Équipe
            </th>
            {columns.map((c) => header(c.key, c.label, 'text-right'))}
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">Cartes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-pitch-700">
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">
                {r.shirtNumber != null ? `${r.shirtNumber}. ` : ''}
                {r.name}
              </th>
              <td className={`whitespace-nowrap px-3 py-2 ${r.side === 'home' ? 'text-mint-400' : 'text-away'}`}>{r.teamName}</td>
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                  {c.total ? `${r[c.key]} / ${r[c.total]}` : show(r[c.key], c.suffix)}
                </td>
              ))}
              <td className="whitespace-nowrap px-3 py-2 text-right">
                <Link to={`/statistiques?match=${matchId}&player=${r.id}`} className="text-mint-400 underline">
                  Voir les cartes
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
