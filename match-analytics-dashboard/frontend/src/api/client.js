const BASE = '/api'
const TOKEN_KEY = 'match_analytics_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request(method, path, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez que l'API est démarrée.", 0)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      tokenStore.clear()
      window.dispatchEvent(new Event('auth:expired'))
    }
    throw new ApiError(data?.error || 'Erreur inattendue', response.status, data?.details)
  }
  return data
}

// Télécharge un fichier protégé (PDF) en envoyant le jeton de connexion.
async function download(path, fallbackName) {
  const token = tokenStore.get()
  let response
  try {
    response = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifiez que l'API est démarrée.", 0)
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    if (response.status === 401) {
      tokenStore.clear()
      window.dispatchEvent(new Event('auth:expired'))
    }
    throw new ApiError((data && data.error) || 'Téléchargement impossible', response.status)
  }
  const blob = await response.blob()
  const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = match ? match[1] : fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  download,
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
}

// Message lisible : ajoute le détail des champs invalides renvoyé par l'API.
export function errorMessage(err) {
  if (err instanceof ApiError && Array.isArray(err.details) && err.details.length > 0) {
    return `${err.message} : ${err.details.map((d) => d.message).join(' ; ')}`
  }
  return (err && err.message) || 'Erreur inattendue'
}
