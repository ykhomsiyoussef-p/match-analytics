import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { CSV_TEMPLATE } from '../data/csvTemplate.js'
import FileDropzone from '../components/import/FileDropzone.jsx'
import ImportMapping from '../components/import/ImportMapping.jsx'
import ImportReport from '../components/import/ImportReport.jsx'
import ImportHistory from '../components/import/ImportHistory.jsx'

const MAX_BYTES = 5 * 1024 * 1024
const STEPS = ['Fichier', 'Colonnes', 'Vérification', 'Résultat']
const DEFAULT_OPTIONS = { coordScale: 'percent', duplicatePolicy: 'skip_existing' }

// Lit le fichier en UTF-8 ; si des caractères sont invalides (fichier Excel français), relit en Windows-1252.
async function readFileText(file) {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('\uFFFD')) return utf8
  return new TextDecoder('windows-1252').decode(buffer)
}

function downloadTemplate() {
  const blob = new Blob(['\uFEFF' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modele_evenements_match.csv'
  link.click()
  URL.revokeObjectURL(url)
}

const TYPE_LABELS = {
  shot: 'tirs',
  pass: 'passes',
  corner: 'corners',
  interception: 'interceptions',
  duel: 'duels',
  tactical: 'événements tactiques',
  other: 'autres',
}

export default function DataImport() {
  const [searchParams] = useSearchParams()
  const [matches, setMatches] = useState(null)
  const [matchId, setMatchId] = useState(searchParams.get('match') || '')
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState('')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState(null)
  const [mapping, setMapping] = useState({})
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [report, setReport] = useState(null)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // Liste des matchs disponibles.
  useEffect(() => {
    api
      .get('/matches')
      .then(({ matches: list }) => {
        setMatches(list)
        setMatchId((current) => current || (list[0] ? String(list[0].id) : ''))
      })
      .catch((err) => {
        setMatches([])
        setError(err.message)
      })
  }, [])

  const loadHistory = async (id) => {
    if (!id) return setHistory([])
    try {
      const { imports } = await api.get(`/matches/${id}/imports`)
      setHistory(imports)
    } catch {
      setHistory([])
    }
  }

  const resetWizard = () => {
    setStep(0)
    setFileName('')
    setCsv('')
    setPreview(null)
    setMapping({})
    setOptions(DEFAULT_OPTIONS)
    setReport(null)
    setResult(null)
    setError('')
  }

  // Changement de match : on repart de zéro.
  useEffect(() => {
    resetWizard()
    setNotice('')
    loadHistory(matchId)
  }, [matchId])

  const handleFile = async (file) => {
    setError('')
    setNotice('')
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError('Format non pris en charge : choisissez un fichier .csv ou .txt.')
      return
    }
    if (file.size === 0) {
      setError('Le fichier est vide.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Fichier trop volumineux (5 Mo maximum).')
      return
    }
    setBusy(true)
    try {
      const text = await readFileText(file)
      const data = await api.post(`/matches/${matchId}/imports/preview`, { csv: text })
      setCsv(text)
      setFileName(file.name)
      setPreview(data)
      setMapping(data.suggestedMapping)
      setOptions((o) => ({ ...o, coordScale: data.suggestedScale }))
      setStep(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleValidate = async () => {
    setError('')
    setBusy(true)
    try {
      const { report: data } = await api.post(`/matches/${matchId}/imports/validate`, { csv, mapping, options })
      setReport(data)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    setError('')
    setBusy(true)
    try {
      const { result: data } = await api.post(`/matches/${matchId}/imports`, { csv, mapping, options, fileName })
      setResult(data)
      setStep(3)
      loadHistory(matchId)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleUndo = async (imp) => {
    const ok = window.confirm(
      `Annuler l'import « ${imp.fileName || 'sans nom'} » ? Les ${imp.importedRows} événements importés seront supprimés.`
    )
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      const { deletedEvents } = await api.delete(`/matches/${matchId}/imports/${imp.id}`)
      setNotice(`Import annulé : ${deletedEvents} événements supprimés.`)
      await loadHistory(matchId)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const selectedMatch = matches?.find((m) => String(m.id) === String(matchId))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Importation des données</h1>
          <p className="mt-2 max-w-prose text-chalk-muted">
            Importez un seul fichier CSV contenant tous les événements du match : tirs, passes, corners, interceptions,
            duels... Une ligne correspond à un événement.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-md border border-pitch-600 px-4 py-2.5 text-sm font-medium hover:bg-pitch-700"
        >
          Télécharger le modèle CSV
        </button>
      </div>

      {matches === null && <p className="text-chalk-muted">Chargement...</p>}

      {matches !== null && matches.length === 0 && (
        <p className="text-chalk-muted">
          Vous n'avez pas encore de match.{' '}
          <Link to="/matchs/nouveau" className="text-mint-400 underline">
            Créez-en un
          </Link>{' '}
          avant d'importer des données.
        </p>
      )}

      {matches !== null && matches.length > 0 && (
        <>
          <label className="block max-w-md text-sm">
            <span className="font-medium">Match concerné</span>
            <select
              className="mt-1 w-full rounded-md border border-pitch-600 bg-pitch-800 px-3 py-2"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              disabled={busy}
            >
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.home.name} contre {m.away.name}, {m.matchDate}
                  {m.isDemo ? ' (démonstration)' : ''}
                </option>
              ))}
            </select>
          </label>

          <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Étapes de l'importation">
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i === step ? 'step' : undefined}
                className={i === step ? 'font-semibold text-mint-400' : i < step ? 'text-chalk' : 'text-chalk-muted'}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>

          {error && (
            <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-md border border-mint-400/40 bg-mint-400/10 px-4 py-3 text-sm text-mint-300">
              {notice}
            </p>
          )}

          {step === 0 && (
            <>
              <FileDropzone onFile={handleFile} disabled={busy} />
              <p className="text-sm text-chalk-muted">
                Dans le modèle, remplacez « Équipe A » et « Équipe B » par les noms exacts des équipes du match
                {selectedMatch ? ` (${selectedMatch.home.name} et ${selectedMatch.away.name})` : ''}.
              </p>
            </>
          )}

          {step === 1 && preview && (
            <>
              <p className="text-sm text-chalk-muted">
                Fichier : <strong className="text-chalk">{fileName}</strong>
              </p>
              <ImportMapping
                preview={preview}
                mapping={mapping}
                setMapping={setMapping}
                options={options}
                setOptions={setOptions}
                onBack={resetWizard}
                onValidate={handleValidate}
                busy={busy}
              />
            </>
          )}

          {step === 2 && report && (
            <ImportReport report={report} onBack={() => setStep(1)} onConfirm={handleConfirm} busy={busy} />
          )}

          {step === 3 && result && (
            <section className="rounded-lg border border-mint-400/40 bg-pitch-800 p-6">
              <h2 className="font-display text-xl font-semibold text-mint-400">Importation terminée</h2>
              <ul className="mt-3 space-y-1 text-sm">
                <li>{result.importedRows} lignes importées.</li>
                {result.skippedDuplicates > 0 && <li>{result.skippedDuplicates} doublons ignorés.</li>}
                {result.errorRows > 0 && <li>{result.errorRows} lignes rejetées.</li>}
                {result.newPlayerCount > 0 && <li>{result.newPlayerCount} joueurs créés.</li>}
              </ul>
              <p className="mt-3 text-sm text-chalk-muted">
                Détail :{' '}
                {Object.entries(result.byType)
                  .map(([type, n]) => `${n} ${TYPE_LABELS[type] || type}`)
                  .join(', ')}
                .
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to={`/matchs/${matchId}`}
                  className="rounded-md bg-mint-400 px-4 py-2.5 text-sm font-semibold text-pitch-900 hover:bg-mint-300"
                >
                  Voir le tableau de bord du match
                </Link>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="rounded-md border border-pitch-600 px-4 py-2.5 text-sm font-medium hover:bg-pitch-700"
                >
                  Importer un autre fichier
                </button>
              </div>
            </section>
          )}

          <ImportHistory imports={history} onUndo={handleUndo} busy={busy} />
        </>
      )}
    </div>
  )
}
