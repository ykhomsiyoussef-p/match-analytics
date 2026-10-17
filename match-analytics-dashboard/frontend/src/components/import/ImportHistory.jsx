const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function ImportHistory({ imports, onUndo, busy }) {
  if (imports.length === 0) return null

  return (
    <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
      <h2 className="font-display text-lg font-semibold">Imports de ce match</h2>
      <ul className="mt-3 divide-y divide-pitch-600">
        {imports.map((imp) => (
          <li key={imp.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">{imp.fileName || 'Fichier sans nom'}</p>
              <p className="text-chalk-muted">
                {formatDateTime(imp.createdAt)}, par {imp.importedBy}. {imp.importedRows} lignes importées
                {imp.skippedRows > 0 ? `, ${imp.skippedRows} ignorées (doublons)` : ''}
                {imp.errorRows > 0 ? `, ${imp.errorRows} rejetées` : ''}.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUndo(imp)}
              className="rounded-md border border-red-400/40 px-3 py-1.5 text-red-300 hover:bg-red-400/10 disabled:opacity-60"
            >
              Annuler cet import
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
