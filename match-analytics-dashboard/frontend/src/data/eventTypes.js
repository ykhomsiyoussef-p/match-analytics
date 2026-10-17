export const EVENT_TYPES = [
  { value: 'shot', label: 'Tirs' },
  { value: 'pass', label: 'Passes' },
  { value: 'corner', label: 'Corners' },
  { value: 'interception', label: 'Interceptions' },
  { value: 'duel', label: 'Duels' },
  { value: 'tactical', label: 'Événements tactiques' },
  { value: 'other', label: 'Autres' },
]

const TYPE_LABEL = {
  shot: 'Tir',
  pass: 'Passe',
  corner: 'Corner',
  interception: 'Interception',
  duel: 'Duel',
  tactical: 'Tactique',
  other: 'Autre',
}

const OUTCOME_LABEL = {
  goal: 'But',
  saved: 'Cadré (arrêté)',
  blocked: 'Contré',
  off_target: 'Non cadré',
  post: 'Poteau',
  success: 'Réussie',
  failed: 'Ratée',
  won: 'Gagné',
  lost: 'Perdu',
}

export const eventTypeLabel = (type) => TYPE_LABEL[type] || type
export const outcomeLabel = (outcome) => (outcome ? OUTCOME_LABEL[outcome] || outcome : '')
