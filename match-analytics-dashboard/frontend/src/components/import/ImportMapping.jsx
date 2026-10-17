const SCALES = [
  { value: 'percent', label: '0 à 100 (pourcentage du terrain)' },
  { value: 'unit', label: '0 à 1' },
  { value: 'statsbomb', label: '120 × 80 (StatsBomb)' },
  { value: 'meters', label: '105 × 68 (mètres)' },
]

const selectClass = 'w-full rounded-md border border-pitch-600 bg-pitch-900 px-3 py-2 text-sm'

export default function ImportMapping({ preview, mapping, setMapping, options, setOptions, onBack, onValidate, busy }) {
  const missing = preview.fields.filter((f) => f.required && !mapping[f.key])
  const hasCoords = Boolean(mapping.x || mapping.y || mapping.endX || mapping.endY)

  const setField = (field) => (e) => setMapping((m) => ({ ...m, [field]: e.target.value }))

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
        <h2 className="font-display text-lg font-semibold">Aperçu du fichier</h2>
        <p className="mt-1 text-sm text-chalk-muted">
          {preview.totalRows} lignes et {preview.headers.length} colonnes détectées. Voici les premières lignes :
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-pitch-600 text-chalk-muted">
                {preview.headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-b border-pitch-700">
                  {row.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-3 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
        <h2 className="font-display text-lg font-semibold">Correspondance des colonnes</h2>
        <p className="mt-1 text-sm text-chalk-muted">
          Associez chaque champ de la plateforme à une colonne de votre fichier. Les colonnes proposées ont été
          reconnues automatiquement : vérifiez-les. Les colonnes non utilisées sont conservées telles quelles avec
          chaque événement.
        </p>
        <p className="mt-2 text-sm text-chalk-muted">
          Équipes attendues dans la colonne « Équipe » : <strong className="text-chalk">{preview.teams.home}</strong> et{' '}
          <strong className="text-chalk">{preview.teams.away}</strong>.
        </p>

        <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {preview.fields.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="font-medium">
                {f.label}
                {f.required && <span className="ml-1 text-xs font-normal text-away">(obligatoire)</span>}
              </span>
              <select className={`${selectClass} mt-1`} value={mapping[f.key] || ''} onChange={setField(f.key)}>
                <option value="">Non utilisé</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-chalk-muted">{f.help}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
        <h2 className="font-display text-lg font-semibold">Options</h2>
        <div className="mt-4 space-y-4">
          {hasCoords && (
            <label className="block max-w-md text-sm">
              <span className="font-medium">Échelle des coordonnées</span>
              <select
                className={`${selectClass} mt-1`}
                value={options.coordScale}
                onChange={(e) => setOptions((o) => ({ ...o, coordScale: e.target.value }))}
              >
                {SCALES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-chalk-muted">
                Choisie d'après les valeurs de votre fichier : vérifiez-la. Elle sert à placer les tirs et les
                passes sur le terrain.
              </span>
            </label>
          )}

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={options.duplicatePolicy === 'skip_existing'}
              onChange={(e) =>
                setOptions((o) => ({ ...o, duplicatePolicy: e.target.checked ? 'skip_existing' : 'import_all' }))
              }
            />
            <span>
              Ignorer les lignes déjà présentes dans ce match
              <span className="block text-xs text-chalk-muted">
                Évite d'importer deux fois le même fichier. Décochez pour tout importer.
              </span>
            </span>
          </label>
        </div>
      </section>

      {missing.length > 0 && (
        <p className="rounded-md border border-away/40 bg-away/10 px-4 py-2.5 text-sm text-away">
          Champs obligatoires à associer : {missing.map((f) => f.label).join(', ')}.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-pitch-600 px-4 py-2.5 text-sm font-medium hover:bg-pitch-700"
        >
          Changer de fichier
        </button>
        <button
          type="button"
          onClick={onValidate}
          disabled={busy || missing.length > 0}
          className="rounded-md bg-mint-400 px-5 py-2.5 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60"
        >
          {busy ? 'Vérification...' : 'Vérifier les données'}
        </button>
      </div>
    </div>
  )
}
