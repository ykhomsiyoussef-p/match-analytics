export default function StatDuel({ label, home, away, suffix = '' }) {
  const total = home + away || 1
  const homePct = (home / total) * 100

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold tabular-nums text-mint-400">
          {home}
          {suffix}
        </span>
        <span className="text-chalk-muted">{label}</span>
        <span className="font-semibold tabular-nums text-away">
          {away}
          {suffix}
        </span>
      </div>
      <div
        className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-pitch-700"
        role="img"
        aria-label={`${label} : ${home}${suffix} contre ${away}${suffix}`}
      >
        <div className="bg-mint-400" style={{ width: `${homePct}%` }} />
        <div className="flex-1 bg-away" />
      </div>
    </div>
  )
}
