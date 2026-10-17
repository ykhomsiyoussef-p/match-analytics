import { createContext, useContext, useEffect, useState } from 'react'
import { api, tokenStore } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(tokenStore.get()))

  // Au chargement : si un jeton existe, on vérifie qu'il est encore valide.
  useEffect(() => {
    if (!tokenStore.get()) return
    api
      .get('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  // Session expirée (401 renvoyé par l'API).
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const login = async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password })
    tokenStore.set(token)
    setUser(user)
    return user
  }

  const logout = () => {
    tokenStore.clear()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
