import { NavLink } from 'react-router-dom'
import Icon from './Icon.jsx'
import { useAuth } from '../auth/AuthContext.jsx'

const WRITERS = ['admin', 'analyste'] // les entraîneurs consultent : ils n'ont pas les pages de saisie

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: 'home', end: true },
  { to: '/matchs', label: 'Mes matchs', icon: 'calendar', end: true },
  { to: '/matchs/nouveau', label: 'Nouveau match', icon: 'plus', roles: WRITERS },
  { to: '/import', label: 'Importation des données', icon: 'upload', roles: WRITERS },
  { to: '/video', label: 'Analyse vidéo', icon: 'play', roles: WRITERS },
  { to: '/statistiques', label: 'Statistiques du match', icon: 'chart' },
  { to: '/joueurs', label: 'Performance des joueurs', icon: 'users' },
  { to: '/rapports', label: 'Rapports', icon: 'file' },
  { to: '/parametres', label: 'Paramètres', icon: 'sliders' },
]

const ROLE_LABELS = {
  admin: 'Administrateur',
  analyste: 'Analyste vidéo',
  entraineur: 'Entraîneur',
}

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-mint-400/15 text-mint-300'
      : 'text-chalk-muted hover:bg-pitch-700 hover:text-chalk'
  }`

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-pitch-600 bg-pitch-800 transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-xl font-semibold text-mint-400">Match Analytics</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="rounded-md p-1.5 text-chalk-muted hover:bg-pitch-700 lg:hidden"
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Navigation principale">
          {NAV.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onClose}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-pitch-600 px-5 py-4">
          <p className="truncate text-sm font-medium">{user?.fullName}</p>
          <p className="text-xs text-chalk-muted">{ROLE_LABELS[user?.role]}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 text-sm text-chalk-muted underline hover:text-chalk"
          >
            Se déconnecter
          </button>
        </div>
      </aside>
    </>
  )
}
