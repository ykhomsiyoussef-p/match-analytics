import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Icon from './Icon.jsx'

export default function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-pitch-600 bg-pitch-900/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="rounded-md p-2 hover:bg-pitch-700"
        >
          <Icon name="menu" />
        </button>
        <span className="font-display text-lg font-semibold">Match Analytics</span>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}
