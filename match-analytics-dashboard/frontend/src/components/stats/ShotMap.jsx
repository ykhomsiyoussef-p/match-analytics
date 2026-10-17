import Pitch, { toPitch, teamColor } from './Pitch.jsx'
import { outcomeLabel } from '../../data/eventTypes.js'

const radius = (xg) => (xg === null ? 1.8 : 1 + xg * 3.5) // la taille reflète le xG, quand il est fourni

// Carte des tirs. Seuls les tirs avec coordonnées sont dessinés.
// But : disque plein avec anneau ; cadré : disque plein ; non cadré, contré ou poteau : cercle vide.
export default function ShotMap({ shots, teamNames, playerName }) {
  const drawn = shots.filter((s) => s.x !== null && s.y !== null)
  const goals = drawn.filter((s) => s.outcome === 'goal').length

  return (
    <Pitch label={`Carte des tirs : ${drawn.length} tirs dont ${goals} buts`}>
      {drawn.map((s) => {
        const [cx, cy] = toPitch(s.x, s.y)
        const color = teamColor(s.side)
        const r = radius(s.xg)
        const hasEnd = s.endX !== null && s.endY !== null
        const [ex, ey] = hasEnd ? toPitch(s.endX, s.endY) : [0, 0]
        const hollow = !s.onTarget
        const text = [
          teamNames[s.side],
          playerName(s.playerId),
          `${s.minute}'`,
          outcomeLabel(s.outcome),
          s.xg !== null ? `xG ${s.xg}` : null,
        ]
          .filter(Boolean)
          .join(', ')
        return (
          <g key={s.id}>
            <title>{text}</title>
            {hasEnd && s.onTarget && (
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={color} strokeWidth="0.25" strokeOpacity="0.45" />
            )}
            {s.outcome === 'goal' && (
              <circle cx={cx} cy={cy} r={r + 1.1} fill="none" stroke="#ffffff" strokeWidth="0.35" />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={hollow ? 'none' : color}
              fillOpacity={hollow ? 0 : 0.9}
              stroke={color}
              strokeWidth={hollow ? 0.55 : 0.3}
            />
          </g>
        )
      })}
    </Pitch>
  )
}
