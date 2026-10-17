import { key, parseNumber } from './normalizers.js'

// Champs de la plateforme auxquels une colonne du CSV peut être associée.
// `synonyms` : noms de colonnes courants (déjà normalisés par key()) pour la suggestion automatique.
export const IMPORT_FIELDS = [
  {
    key: 'eventType', label: "Type d'événement", required: true,
    help: 'tir, but, passe, corner, interception, duel, tactique',
    synonyms: ['event_type', 'event', 'type', 'type_evenement', 'evenement', 'action', 'type_event'],
  },
  {
    key: 'team', label: 'Équipe', required: true,
    help: "Nom de l'équipe, identique à celui saisi pour le match",
    synonyms: ['team', 'equipe', 'club', 'team_name', 'nom_equipe'],
  },
  {
    key: 'minute', label: 'Minute', required: true,
    help: 'Minute de jeu, par exemple 23 ou 45+2',
    synonyms: ['minute', 'min', 'minutes', 'match_minute', 'minute_jeu'],
  },
  {
    key: 'second', label: 'Seconde', required: false,
    help: 'Seconde dans la minute (0 à 59)',
    synonyms: ['second', 'sec', 'seconds', 'seconde', 'secondes', 'match_second'],
  },
  {
    key: 'period', label: 'Période', required: false,
    help: '1 ou 2 (3 et 4 : prolongations). Déduite de la minute si absente',
    synonyms: ['period', 'periode', 'half', 'mi_temps', 'mitemps'],
  },
  {
    key: 'player', label: 'Joueur', required: false,
    help: 'Nom du joueur (créé automatiquement s\'il n\'existe pas)',
    synonyms: ['player', 'joueur', 'player_name', 'nom_joueur'],
  },
  {
    key: 'shirtNumber', label: 'Numéro de maillot', required: false,
    help: 'Utilisé uniquement pour les nouveaux joueurs',
    synonyms: ['shirt_number', 'shirt', 'numero', 'num', 'maillot', 'jersey', 'jersey_number', 'numero_maillot'],
  },
  {
    key: 'videoTime', label: 'Temps vidéo', required: false,
    help: 'En secondes ou mm:ss. Différent de la minute de jeu',
    synonyms: ['video_time', 'temps_video', 'video_timestamp', 'video_seconds', 'timestamp'],
  },
  {
    key: 'x', label: 'Position x', required: false,
    help: 'Position sur la longueur du terrain',
    synonyms: ['x', 'pos_x', 'position_x', 'location_x', 'start_x', 'x_start', 'coord_x'],
  },
  {
    key: 'y', label: 'Position y', required: false,
    help: 'Position sur la largeur du terrain',
    synonyms: ['y', 'pos_y', 'position_y', 'location_y', 'start_y', 'y_start', 'coord_y'],
  },
  {
    key: 'endX', label: 'Arrivée x', required: false,
    help: "Point d'arrivée d'une passe ou d'un tir",
    synonyms: ['end_x', 'x_end', 'pass_end_x', 'x_fin', 'x2', 'arrivee_x'],
  },
  {
    key: 'endY', label: 'Arrivée y', required: false,
    help: "Point d'arrivée d'une passe ou d'un tir",
    synonyms: ['end_y', 'y_end', 'pass_end_y', 'y_fin', 'y2', 'arrivee_y'],
  },
  {
    key: 'outcome', label: 'Résultat', required: false,
    help: 'Tirs : but, cadré, non cadré, contré, poteau. Duels : gagné, perdu',
    synonyms: ['outcome', 'result', 'resultat', 'issue', 'shot_outcome', 'resultat_tir'],
  },
  {
    key: 'passSuccess', label: 'Passe réussie', required: false,
    help: 'oui/non, vrai/faux ou 1/0 (obligatoire pour les passes)',
    synonyms: ['pass_success', 'success', 'reussie', 'reussite', 'pass_outcome', 'completed', 'accurate', 'passe_reussie'],
  },
  {
    key: 'keyPass', label: 'Passe clé', required: false,
    help: 'oui/non',
    synonyms: ['key_pass', 'passe_cle', 'is_key_pass', 'keypass'],
  },
  {
    key: 'xg', label: 'xG', required: false,
    help: 'Valeur entre 0 et 1',
    synonyms: ['xg', 'expected_goals', 'xg_value'],
  },
  {
    key: 'bodyPart', label: 'Partie du corps', required: false,
    help: 'pied droit, pied gauche, tête',
    synonyms: ['body_part', 'partie_du_corps', 'corps', 'foot'],
  },
]

export const FIELD_KEYS = IMPORT_FIELDS.map((f) => f.key)
export const REQUIRED_FIELDS = IMPORT_FIELDS.filter((f) => f.required)

// Propose une correspondance colonne -> champ d'après le nom des colonnes.
export function suggestMapping(headers) {
  const byKey = new Map(headers.map((h) => [key(h), h]))
  const mapping = {}
  const used = new Set()
  for (const field of IMPORT_FIELDS) {
    const hit = field.synonyms.map((s) => byKey.get(s)).find((h) => h !== undefined && !used.has(h))
    if (hit !== undefined) {
      mapping[field.key] = hit
      used.add(hit)
    }
  }
  return mapping
}

// Devine l'échelle des coordonnées d'après les valeurs maximales du fichier.
export function suggestScale(parsed, mapping) {
  const maxOf = (field) => {
    const col = parsed.headers.indexOf(mapping[field])
    if (col < 0) return null
    let max = null
    for (const row of parsed.rows) {
      const n = parseNumber(row[col] ?? '')
      if (!Number.isNaN(n) && (max === null || n > max)) max = n
    }
    return max
  }
  const mx = maxOf('x')
  const my = maxOf('y')
  if (mx === null || my === null) return 'percent'
  if (mx <= 1.0001 && my <= 1.0001) return 'unit'
  if (mx <= 100.01 && my <= 100.01) return 'percent'
  if (mx <= 105.01 && my <= 68.01) return 'meters'
  if (mx <= 120.01 && my <= 80.01) return 'statsbomb'
  return 'percent'
}
