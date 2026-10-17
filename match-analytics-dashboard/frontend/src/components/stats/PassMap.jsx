import Pitch, { toPitch, teamColor, HOME_COLOR, AWAY_COLOR } from './Pitch.jsx'

const ARROWS = [
  ['home', HOME_COLOR],
  ['away', AWAY_COLOR],
]

const defs = (
  <defs>
    {ARROWS.map(([side, color]) => (
      <marker
        key={side}
        id={`pass-arrow-${side}`}
        markerUnits="userSpaceOnUse"
        markerWidth="1.8"
        markerHeight="1.8"
        refX="1.6"
        refY="0.9"
        orient="auto"
      >
        <path d="M0,0 L1.8,0.9 L0,1.8 z" fill={color} />
      </marker>
    ))}
  </defs>
)

// Carte des passes : une flèche du point de départ au point d'arrivée.
// Réussie : trait plein ; ratée : pointillés ; passe clé : trait épais avec point de départ marqué.
export default function PassMap({ passes, teamNames, playerName }) {
  const drawn = passes.filter((p) => p.x !== null && p.y !== null && p.endX !== null && p.endY !== null)

  return (
    <Pitch label={`Carte des passes : ${drawn.length} passes affichées`} defs={defs}>
      {drawn.map((p) => {
        const [x1, y1] = toPitch(p.x, p.y)
        const [x2, y2] = toPitch(p.endX, p.endY)
        const color = teamColor(p.side)
        const key = p.keyPass === true
        const failed = p.passSuccess === false
        const text = [
          teamNames[p.side],
          playerName(p.playerId),
          `${p.minute}'`,
          failed ? 'passe ratée' : 'passe réussie',
          key ? 'passe clé' : null,
        ]
          .filter(Boolean)
          .join(', ')
        return (
          <g key={p.id}>
            <title>{text}</title>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={key ? 0.7 : 0.3}
              strokeOpacity={failed ? 0.85 : key ? 1 : 0.5}
              strokeDasharray={failed ? '1 0.8' : undefined}
              markerEnd={`url(#pass-arrow-${p.side})`}
            />
            {key && <circle cx={x1} cy={y1} r="0.9" fill={color} />}
          </g>
        )
      })}
    </Pitch>
  )
}
