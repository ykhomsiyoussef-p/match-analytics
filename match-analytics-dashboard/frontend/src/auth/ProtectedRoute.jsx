import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="p-8 text-chalk-muted">Chargement...</p>
  }
  if (!user) {
    return <Navigate to="/connexion" replace />
  }
  return <Outlet />
}
