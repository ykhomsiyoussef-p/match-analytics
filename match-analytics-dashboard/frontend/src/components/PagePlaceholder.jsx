export default function PagePlaceholder({ title, description, availableIn }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-prose text-chalk-muted">{description}</p>
      <div className="mt-8 rounded-lg border border-dashed border-pitch-600 p-6">
        <p className="font-medium">Cette page n'est pas encore active.</p>
        <p className="mt-1 text-sm text-chalk-muted">Elle sera développée {availableIn}.</p>
      </div>
    </div>
  )
}
