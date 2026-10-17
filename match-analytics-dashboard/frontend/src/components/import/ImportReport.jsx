const TYPE_LABELS = {
  shot: 'Tirs',
  pass: 'Passes',
  corner: 'Corners',
  interception: 'Interceptions',
  duel: 'Duels',
  tactical: 'Événements tactiques',
  other: 'Autres',
}

function Tile({ label, value, tone = 'text-chalk' }) {
  return (
    <div className="rounded-lg border border-pitch-600 bg-pitch-800 p-4">
      <p className="text-sm text-chalk-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

function buildNotices(report) {
  const w = report.warnings
  const notices = []
  if (report.newPlayerCount > 0) {
    const names = report.newPlayerNames.join(', ')
    const more = report.newPlayerCount > report.newPlayerNames.length ? ', ...' : ''
    notices.push(`${report.newPlayerCount} nouveaux joueurs seront créés : ${names}${more}.`)
  }
  if (report.duplicatesInDb > 0) {
    notices.push(
      report.skippedDuplicates > 0
        ? `${report.duplicatesInDb} lignes sont déjà présentes dans ce match : elles seront ignorées.`
        : `${report.duplicatesInDb} lignes sont déjà présentes dans ce match : elles seront importées une seconde fois.`
    )
  }
  if (report.duplicatesInFile > 0) {
    notices.push(`${report.duplicatesInFile} lignes sont identiques à une autre ligne du fichier (elles sont conservées).`)
  }
  if (w.rowsWithoutPlayer > 0) notices.push(`${w.rowsWithoutPlayer} tirs ou passes sans joueur renseigné.`)
  if (w.rowsWithoutCoordinates > 0) {
    notices.push(`${w.rowsWithoutCoordinates} tirs ou passes sans coordonnées : ils n'apparaîtront pas sur les cartes.`)
  }
  if (w.incompleteCoordinates > 0) {
    notices.push(`${w.incompleteCoordinates} positions incomplètes (x sans y, ou l'inverse) ont été ignorées.`)
  }
  if (w.duelsWithoutOutcome > 0) {
    notices.push(`${w.duelsWithoutOutcome} duels sans résultat : ils ne comptent ni comme gagnés ni comme perdus.`)
  }
  if (w.invalidShirtNumbers > 0) notices.push(`${w.invalidShirtNumbers} numéros de maillot invalides ont été ignorés.`)
  if (report.goalsCheck) {
    const { file, match } = report.goalsCheck
    notices.push(
      `Le fichier contient ${file.home} : ${file.away} buts alors que le score saisi pour le match est ${match.home} : ${match.away}.`
    )
  }
  return notices
}

export default function ImportReport({ report, onBack, onConfirm, busy }) {
  const notices = buildNotices(report)
  const types = Object.entries(report.byType)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Lignes lues" value={report.totalRows} />
        <Tile label="Lignes valides" value={report.validRows} tone="text-mint-400" />
        <Tile label="Lignes en erreur" value={report.errorRows} tone={report.errorRows > 0 ? 'text-red-300' : 'text-chalk'} />
        <Tile label="Lignes à importer" value={report.willImport} tone="text-mint-400" />
      </div>

      {types.length > 0 && (
        <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
          <h2 className="font-display text-lg font-semibold">Contenu qui sera importé</h2>
          <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {types.map(([type, count]) => (
              <li key={type}>
                <span className="font-semibold tabular-nums">{count}</span>{' '}
                <span className="text-chalk-muted">{TYPE_LABELS[type] || type}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notices.length > 0 && (
        <section className="rounded-lg border border-away/40 bg-away/10 p-5">
          <h2 className="font-display text-lg font-semibold text-away">À vérifier</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
            {notices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {report.errorRows > 0 && (
        <section className="rounded-lg border border-pitch-600 bg-pitch-800 p-5">
          <h2 className="font-display text-lg font-semibold">Lignes rejetées</h2>
          <p className="mt-1 text-sm text-chalk-muted">
            Ces lignes ne seront pas importées. Corrigez-les dans votre fichier puis importez-le à nouveau, ou
            continuez sans elles.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-pitch-600 text-chalk-muted">
                  <th className="px-3 py-2 font-medium">Ligne</th>
                  <th className="px-3 py-2 font-medium">Problème</th>
                </tr>
              </thead>
              <tbody>
                {report.errors.map((e) => (
                  <tr key={e.row} className="border-b border-pitch-700 align-top">
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{e.row}</td>
                    <td className="px-3 py-1.5">{e.messages.join(' ; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.errorsTruncated > 0 && (
            <p className="mt-3 text-sm text-chalk-muted">... et {report.errorsTruncated} autres lignes en erreur.</p>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-pitch-600 px-4 py-2.5 text-sm font-medium hover:bg-pitch-700"
        >
          Retour aux colonnes
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || report.willImport === 0}
          className="rounded-md bg-mint-400 px-5 py-2.5 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60"
        >
          {busy ? 'Importation...' : `Importer ${report.willImport} lignes`}
        </button>
      </div>
      {report.willImport === 0 && (
        <p className="text-sm text-chalk-muted">Aucune ligne à importer avec ces réglages.</p>
      )}
    </div>
  )
}
