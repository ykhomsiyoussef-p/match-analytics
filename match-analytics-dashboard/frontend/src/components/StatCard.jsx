const format = (v) => (Number.isInteger(v) ? v : v.toFixed(1))

export default function StatCard({ label, value, suffix = '', homeName, awayName }) {
  return (
    <div className="rounded-lg border border-pitch-600 bg-pitch-800 p-4">
      <p className="text-sm text-chalk-muted">{label}</p>
      {value ? (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-semibold tabular-nums text-mint-400">
              {format(value.home)}
              {suffix}
            </p>
            <p className="text-xs text-chalk-muted">{homeName}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold tabular-nums text-away">
              {format(value.away)}
              {suffix}
            </p>
            <p className="text-xs text-chalk-muted">{awayName}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-chalk-muted">Aucune donnée pour ce match</p>
      )}
    </div>
  )
}
