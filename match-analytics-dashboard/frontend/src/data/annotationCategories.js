// Catégories d'annotation (mêmes valeurs que la base de données) et couleur du repère sur la timeline.
export const ANNOTATION_CATEGORIES = [
  { value: 'but', label: 'But', tone: 'positive' },
  { value: 'tir', label: 'Tir', tone: 'neutral' },
  { value: 'passe_cle', label: 'Passe clé', tone: 'positive' },
  { value: 'organisation_offensive', label: 'Organisation offensive', tone: 'neutral' },
  { value: 'organisation_defensive', label: 'Organisation défensive', tone: 'neutral' },
  { value: 'transition_offensive', label: 'Transition offensive', tone: 'neutral' },
  { value: 'transition_defensive', label: 'Transition défensive', tone: 'neutral' },
  { value: 'coup_de_pied_arrete', label: 'Coup de pied arrêté', tone: 'neutral' },
  { value: 'erreur_individuelle', label: 'Erreur individuelle', tone: 'negative' },
  { value: 'point_fort', label: 'Point fort', tone: 'positive' },
  { value: 'point_a_ameliorer', label: 'Point à améliorer', tone: 'negative' },
  { value: 'commentaire_libre', label: 'Commentaire libre', tone: 'neutral' },
]

export const CATEGORY_BY_VALUE = Object.fromEntries(ANNOTATION_CATEGORIES.map((c) => [c.value, c]))

export const TONE_BG = {
  positive: 'bg-mint-400',
  negative: 'bg-away',
  neutral: 'bg-chalk',
}
