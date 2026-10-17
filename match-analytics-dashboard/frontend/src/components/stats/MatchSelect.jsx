export default function MatchSelect({ matches, value, onChange }) {
  return (
    <label className="block max-w-md text-sm">
      <span className="font-medium">Match</span>
      <select
        className="mt-1 w-full rounded-md border border-pitch-600 bg-pitch-800 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {matches.map((m) => (
          <option key={m.id} value={m.id}>
            {m.home.name} contre {m.away.name}, {m.matchDate}
            {m.isDemo ? ' (démonstration)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
