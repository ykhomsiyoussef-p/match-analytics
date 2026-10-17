// Onglets accessibles (rôles ARIA, navigation aux flèches).
export default function Tabs({ tabs, active, onChange, label, children }) {
  const handleKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const index = tabs.findIndex((t) => t.id === active)
    const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    onChange(next.id)
    requestAnimationFrame(() => {
      const el = document.getElementById(`tab-${next.id}`)
      if (el) el.focus()
    })
  }

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={handleKeyDown} className="flex gap-1 border-b border-pitch-600">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active === t.id
                ? 'border-mint-400 text-mint-300'
                : 'border-transparent text-chalk-muted hover:text-chalk'
            }`}
          >
            {t.label} <span className="tabular-nums">({t.count})</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="pt-4">
        {children}
      </div>
    </div>
  )
}
