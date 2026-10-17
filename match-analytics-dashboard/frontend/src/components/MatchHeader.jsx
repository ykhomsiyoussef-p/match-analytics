function PitchLines() {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full text-mint-400 opacity-[0.14] [&_*]:[vector-effect:non-scaling-stroke]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="10" y="10" width="380" height="180" />
      <line x1="200" y1="10" x2="200" y2="190" />
      <circle cx="200" cy="100" r="28" />
      <rect x="10" y="55" width="52" height="90" />
      <rect x="338" y="55" width="52" height="90" />
      <rect x="10" y="78" width="18" height="44" />
      <rect x="372" y="78" width="18" height="44" />
    </svg>
  )
}

export default function MatchHeader({ match }) {
  const { home, away, homeScore, awayScore, competition, matchDate } = match
  const formattedDate = new Date(matchDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <section className="relative overflow-hidden rounded-lg border border-pitch-600 bg-pitch-800">
      <PitchLines />
      <div className="relative px-6 py-8 sm:py-12">
        <p className="text-center text-sm text-chalk-muted">
          {competition ? `${competition}, ${formattedDate}` : formattedDate}
        </p>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <p className="text-right font-display text-lg font-semibold text-mint-400 sm:text-3xl">
            {home.name}
          </p>
          <p className="font-display text-5xl font-bold tabular-nums sm:text-7xl">
            {homeScore}
            <span className="px-1.5 text-chalk-muted">:</span>
            {awayScore}
          </p>
          <p className="font-display text-lg font-semibold text-away sm:text-3xl">{away.name}</p>
        </div>
      </div>
    </section>
  )
}
