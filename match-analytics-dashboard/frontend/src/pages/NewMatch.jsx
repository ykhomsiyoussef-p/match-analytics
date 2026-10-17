import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'

const ANALYSIS_TYPES = [
  { value: 'globale', label: 'Analyse globale' },
  { value: 'offensive', label: 'Phase offensive' },
  { value: 'defensive', label: 'Phase défensive' },
  { value: 'coups_arretes', label: 'Coups de pied arrêtés' },
  { value: 'individuelle', label: 'Analyse individuelle' },
]

const inputClass = 'mt-1 w-full rounded-md border border-pitch-600 bg-pitch-800 px-3 py-2'

function Field({ label, error, children }) {
  return (
    <label className="block text-sm">
      {label}
      {children}
      {error && <span className="mt-1 block text-xs text-red-300">{error}</span>}
    </label>
  )
}

export default function NewMatch() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    homeTeamName: '',
    awayTeamName: '',
    matchDate: new Date().toISOString().slice(0, 10),
    competition: '',
    homeScore: 0,
    awayScore: 0,
    analysisType: 'globale',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setSubmitting(true)
    try {
      const { match } = await api.post('/matches', form)
      navigate(`/matchs/${match.id}`)
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])))
      }
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-semibold">Nouveau match</h1>
      <p className="mt-2 text-chalk-muted">Renseignez les informations de base. Vous importerez les données ensuite.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Équipe à domicile" error={fieldErrors.homeTeamName}>
            <input className={inputClass} value={form.homeTeamName} onChange={update('homeTeamName')} required maxLength={100} />
          </Field>
          <Field label="Équipe à l'extérieur" error={fieldErrors.awayTeamName}>
            <input className={inputClass} value={form.awayTeamName} onChange={update('awayTeamName')} required maxLength={100} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date du match" error={fieldErrors.matchDate}>
            <input type="date" className={inputClass} value={form.matchDate} onChange={update('matchDate')} required />
          </Field>
          <Field label="Compétition" error={fieldErrors.competition}>
            <input className={inputClass} value={form.competition} onChange={update('competition')} maxLength={150} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Score à domicile" error={fieldErrors.homeScore}>
            <input type="number" min="0" max="99" className={inputClass} value={form.homeScore} onChange={update('homeScore')} />
          </Field>
          <Field label="Score à l'extérieur" error={fieldErrors.awayScore}>
            <input type="number" min="0" max="99" className={inputClass} value={form.awayScore} onChange={update('awayScore')} />
          </Field>
        </div>

        <Field label="Type d'analyse" error={fieldErrors.analysisType}>
          <select className={inputClass} value={form.analysisType} onChange={update('analysisType')}>
            {ANALYSIS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <p role="alert" className="rounded-md border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-mint-400 px-5 py-2.5 font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60"
        >
          {submitting ? 'Création...' : 'Créer le match'}
        </button>
      </form>
    </div>
  )
}
