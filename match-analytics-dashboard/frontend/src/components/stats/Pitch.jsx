// Terrain de football en SVG (105 m x 68 m). Les coordonnées des données sont des
// pourcentages (0 à 100) : toPitch les convertit en mètres. Les couleurs sont écrites
// directement dans le SVG pour qu'il reste lisible s'il est exporté ou imprimé.
export const HOME_COLOR = '#7be0a4'
export const AWAY_COLOR = '#f2b866'
const LINE = '#33614f'

export const toPitch = (x, y) => [x * 1.05, y * 0.68]
export const teamColor = (side) => (side === 'home' ? HOME_COLOR : AWAY_COLOR)

export default function Pitch({ label, defs = null, children }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 111 74" role="img" aria-label={label} className="h-auto w-full">
      {defs}
      <rect x="-3" y="-3" width="111" height="74" rx="2" fill="#0b1815" />
      <g fill="none" stroke={LINE} strokeWidth="0.35">
        <rect x="0" y="0" width="105" height="68" />
        <line x1="52.5" y1="0" x2="52.5" y2="68" />
        <circle cx="52.5" cy="34" r="9.15" />
        <rect x="0" y="13.84" width="16.5" height="40.32" />
        <rect x="88.5" y="13.84" width="16.5" height="40.32" />
        <rect x="0" y="24.84" width="5.5" height="18.32" />
        <rect x="99.5" y="24.84" width="5.5" height="18.32" />
        <path d="M 16.5 26.69 A 9.15 9.15 0 0 1 16.5 41.31" />
        <path d="M 88.5 41.31 A 9.15 9.15 0 0 1 88.5 26.69" />
        <rect x="-1.5" y="30.34" width="1.5" height="7.32" />
        <rect x="105" y="30.34" width="1.5" height="7.32" />
      </g>
      <g fill={LINE}>
        <circle cx="52.5" cy="34" r="0.4" />
        <circle cx="11" cy="34" r="0.4" />
        <circle cx="94" cy="34" r="0.4" />
      </g>
      {children}
    </svg>
  )
}
