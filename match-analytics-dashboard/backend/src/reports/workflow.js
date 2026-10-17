// Cycle de vie d'un rapport : brouillon -> en validation -> validé -> partagé.
// Ce module ne touche pas à la base : il décide ce que chaque personne a le droit de faire.

export const STATUSES = ['brouillon', 'en_validation', 'valide', 'partage']
export const EDITABLE = ['brouillon', 'en_validation'] // modifiable avant sa validation

// action -> état de départ(s) et état d'arrivée
export const TRANSITIONS = {
  submit: { from: ['brouillon'], to: 'en_validation', permission: 'canSubmit' },
  validate: { from: ['en_validation'], to: 'valide', permission: 'canValidate' },
  reject: { from: ['en_validation'], to: 'brouillon', permission: 'canReject' },
  share: { from: ['valide'], to: 'partage', permission: 'canShare' },
  unshare: { from: ['partage'], to: 'valide', permission: 'canUnshare' },
  reopen: { from: ['valide', 'partage'], to: 'brouillon', permission: 'canReopen' },
}

// user : { id, role } ; report : { authorId, status } ; isMatchOwner : a créé le match ;
// share : null ou { canComment } si le rapport est partagé avec cette personne.
export function reportPermissions({ user, report, isMatchOwner = false, share = null }) {
  const isAdmin = user.role === 'admin'
  const isAuthor = report.authorId === user.id
  // Gérer un rapport : administrateur, ou auteur ayant toujours un rôle d'analyste.
  const manager = isAdmin || (isAuthor && user.role === 'analyste')
  const status = report.status
  const sharedWithMe = Boolean(share) && status === 'partage'

  const canView = isAdmin || isAuthor || isMatchOwner || sharedWithMe
  return {
    canView,
    canDownload: canView,
    canEdit: manager && EDITABLE.includes(status),
    canSubmit: manager && status === 'brouillon',
    canValidate: isAdmin && status === 'en_validation',
    canReject: isAdmin && status === 'en_validation',
    canManageShares: manager && (status === 'valide' || status === 'partage'),
    canShare: manager && status === 'valide',
    canUnshare: manager && status === 'partage',
    canReopen: manager && (status === 'valide' || status === 'partage'),
    canComment: status === 'partage' && (isAdmin || isAuthor || Boolean(share && share.canComment)),
    isManager: manager,
  }
}

// Retourne le nouvel état, ou lève une erreur { code, message } si l'action n'est pas possible.
export function nextStatus(action, status, permissions) {
  const t = TRANSITIONS[action]
  if (!t) return { error: { code: 400, message: 'Action inconnue' } }
  if (!permissions[t.permission]) {
    if (!t.from.includes(status)) {
      return { error: { code: 409, message: "Cette action n'est pas possible dans l'état actuel du rapport" } }
    }
    return { error: { code: 403, message: 'Accès refusé' } }
  }
  return { status: t.to, from: t.from }
}
