import { useRef, useState } from 'react'

export default function FileDropzone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files) => {
    const file = files && files[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      className={`rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
        dragging ? 'border-mint-400 bg-mint-400/10' : 'border-pitch-600 bg-pitch-800'
      }`}
    >
      <p className="font-display text-lg font-semibold">Glissez votre fichier CSV ici</p>
      <p className="mt-1 text-sm text-chalk-muted">ou</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-md bg-mint-400 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-mint-300 disabled:opacity-60"
      >
        {disabled ? 'Lecture du fichier...' : 'Choisir un fichier'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <p className="mt-5 text-xs text-chalk-muted">Fichier CSV ou TXT, 5 Mo maximum</p>
    </div>
  )
}
