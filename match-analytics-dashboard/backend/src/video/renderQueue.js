// File d'attente en mémoire : les clips sont traités un par un, pour ne pas saturer le serveur.
let chain = Promise.resolve()
const pending = new Set()

// Ajoute une tâche ; retourne false si ce clip est déjà en attente.
export function enqueue(id, task) {
  if (pending.has(id)) return false
  pending.add(id)
  chain = chain
    .then(task)
    .catch((err) => console.error('Erreur inattendue dans la file de traitement :', err))
    .finally(() => pending.delete(id))
  return true
}

export const isPending = (id) => pending.has(id)
