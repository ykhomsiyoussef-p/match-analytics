// Sections d'un rapport : champ du formulaire, valeur de la section côté base, libellé.
export const REPORT_SECTIONS = [
  { field: 'summary', link: 'resume', label: 'Résumé du match' },
  { field: 'strengths', link: 'points_forts', label: "Points forts de l'équipe" },
  { field: 'weaknesses', link: 'faiblesses', label: 'Faiblesses observées' },
  { field: 'tacticalIssues', link: 'problemes_tactiques', label: 'Problèmes tactiques' },
  { field: 'individualPerformances', link: 'performances_individuelles', label: 'Performances individuelles' },
  { field: 'recommendations', link: 'recommandations', label: 'Recommandations pour les prochaines séances' },
]

export const STATUS = {
  brouillon: { label: 'Brouillon', className: 'border-pitch-600 text-chalk-muted' },
  en_validation: { label: 'En cours de validation', className: 'border-away/50 text-away' },
  valide: { label: 'Validé', className: 'border-mint-400/50 text-mint-300' },
  partage: { label: 'Partagé', className: 'border-mint-400 bg-mint-400/10 text-mint-300' },
}
