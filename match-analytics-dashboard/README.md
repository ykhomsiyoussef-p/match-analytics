# Match Analytics Dashboard

Plateforme d'analyse statistique et vidéo du football.

## État actuel : étapes 7 et 8 (rapports, comptes, sécurité, tests)

Fonctionnel :
- Schéma PostgreSQL complet (12 tables du cahier des charges + tables de liaison et journal d'audit)
- API Express : connexion (JWT), liste/création/lecture des matchs, tableau de bord calculé depuis les événements
- Contrôle des rôles côté serveur, validation des entrées, requêtes SQL paramétrées
- Frontend branché sur l'API : connexion, Mes matchs, Nouveau match, Tableau de bord
- Match de démonstration FICTIF en base (script de seed)

Étape 3 :
- Page « Importation des données » : dépôt d'un fichier CSV unique (tous les types d'événements), aperçu,
  correspondance des colonnes, validation, détection des doublons, confirmation, résumé, historique et annulation
- Modèle CSV téléchargeable depuis la page, et deux fichiers d'exemple FICTIFS dans le dossier `exemples/`
- Le tableau de bord se calcule à partir des événements importés

Étape 4 :
- Envoi de vidéos MP4, MOV ou WebM par morceaux de 4 Mo, avec barre de progression et reprise après coupure
- Contrôle du contenu du fichier à la fin de l'envoi ; stockage sur disque (`backend/storage/videos`), jamais en base
- Lecture protégée : adresse temporaire liée à l'utilisateur, droits vérifiés à chaque requête, avance rapide possible
- Lecteur : lecture/pause, ±5 s et ±10 s, vitesse, timeline avec repères d'annotations
- Annotations manuelles (12 catégories) : temps courant capturé automatiquement, liste filtrable par catégorie
  et par joueur, clic pour retourner au bon moment
- Repères « coup d'envoi » et « 2e mi-temps » pour distinguer temps vidéo et minute de jeu
- Fichier de test : `exemples/video_test_90s.mp4` (vidéo fictive de 90 secondes)

Étape 5 :
- Onglets « Annotations », « Événements » et « Clips » à côté du lecteur
- Événements du match (importés par CSV) situés dans la vidéo : temps vidéo du CSV, ou estimé d'après les repères
  coup d'envoi et 2e mi-temps ; filtres par type, équipe et joueur ; repères colorés sur la barre de position
- Clips : sélection début/fin, titre, catégorie, joueurs, annotation liée, prévisualisation dans le lecteur,
  génération du fichier MP4 par FFmpeg en arrière-plan (statut, erreurs, relance), lecture et téléchargement protégés
- FFmpeg est nécessaire UNIQUEMENT pour générer le fichier d'un clip (la sélection et la prévisualisation n'en ont pas besoin)

Étape 6 :
- Page « Statistiques du match » : comparaison des équipes (par période), carte des tirs et carte des passes en SVG,
  filtres par équipe, joueur, période et résultat ; option pour placer l'équipe extérieure face à l'autre but
- Page « Performance des joueurs » : tableau triable par joueur, avec lien vers ses cartes
- Règle : une statistique sans donnée dans les fichiers importés s'affiche « — », jamais un faux zéro
- Pas de migration nécessaire, ni de nouvelle dépendance

Étape 7 :
- Rapports d'analyse : résumé, points forts, faiblesses, problèmes tactiques, performances individuelles,
  recommandations, avec annotations et clips joints à chaque section
- Statuts : brouillon, en cours de validation, validé, partagé (modifiable avant sa validation)
- Partage avec des personnes précises, droit de commenter, commentaires
- Rapport en PDF : informations du match, score, statistiques, graphique, cartes des tirs et des passes,
  observations, recommandations, liste des clips avec horodatages et lien vers l'application
- Comptes : l'administrateur crée les comptes (administrateur, analyste, entraîneur), change les rôles,
  désactive, réinitialise les mots de passe ; chacun change son mot de passe
- Un entraîneur ne voit que ce qui est partagé avec lui : jamais la vidéo complète

Étape 8 :
- Tests automatisés : `npm test` dans `backend` et dans `frontend`
- Sécurité : sessions invalidées à chaque changement de mot de passe, limitation générale des requêtes,
  politique de sécurité du contenu pour le site

Pas encore implémenté : annotations, clips, rapports PDF,
gestion des utilisateurs (création de comptes), partage avec les entraîneurs.

## Mise en ligne

Voir `deploiement/GUIDE_DEPLOIEMENT.md` (serveur Ubuntu, HTTPS automatique, sauvegardes).

## Installation

Prérequis : Node.js 18.18+ et PostgreSQL 14+ (ou Docker Desktop).

### 1. Base de données

Avec Docker (depuis la racine du projet) :

    docker compose up -d

Ou avec PostgreSQL installé : créez une base `match_analytics` et adaptez DATABASE_URL.

### 2. Backend

    cd backend
    npm install
    copy .env.example .env      (PowerShell : Copy-Item .env.example .env)

Ouvrez `backend/.env` et renseignez JWT_SECRET, SEED_EMAIL et SEED_PASSWORD, puis :

    npm run db:migrate
    npm run db:seed
    npm run dev

Vérification : http://localhost:4000/api/health doit afficher {"status":"ok","database":"ok"}.

### 3. Frontend (autre terminal)

    cd frontend
    npm install
    npm run dev

Ouvrir http://localhost:5173 et se connecter avec SEED_EMAIL / SEED_PASSWORD.

## Mise à jour depuis l'étape 6

    cd backend
    npm install          (nouvelle dépendance : pdf-lib)
    npm run db:migrate   (OBLIGATOIRE : sans elle, la connexion échoue)
    npm run dev

La migration déconnecte une fois tout le monde : reconnectez-vous.

## Rôles et droits

| | Administrateur | Analyste | Entraîneur |
| --- | --- | --- | --- |
| Créer des matchs, importer, annoter, créer des clips | oui | ses propres matchs | non |
| Voir la vidéo complète | oui | ses propres matchs | non |
| Statistiques d'un match | oui | ses propres matchs | si un rapport est partagé avec lui |
| Rédiger un rapport | oui | ses propres matchs | non |
| Valider un rapport | oui | non | non |
| Voir un rapport | tous | les siens et ceux de ses matchs | ceux partagés avec lui |
| Clips d'un rapport partagé | oui | oui | oui |
| Commenter | oui | oui | si l'auteur l'autorise |
| Gérer les comptes | oui | non | non |

## Mise à jour depuis l'étape 5

    cd backend
    npm run dev          (aucune migration, aucune nouvelle dépendance)

## Mise à jour depuis l'étape 4

    cd backend
    npm install
    npm run db:migrate       (ajoute une colonne aux clips, sans effacer vos données)
    npm run dev

Pour générer le fichier d'un clip, installez FFmpeg (Windows : `winget install Gyan.FFmpeg`, puis rouvrez PowerShell).

## Mise à jour depuis l'étape 3

    cd backend
    npm install          (aucune nouvelle dépendance : à faire par précaution)
    npm run dev          (pas de nouvelle migration : la base ne change pas)

Le fichier `.env` n'a pas besoin de changer. Options facultatives : VIDEO_STORAGE_DIR, MAX_VIDEO_BYTES.

## Mise à jour depuis l'étape 2

    cd backend
    npm install
    npm run db:migrate       (ajoute la table d'historique des imports, sans effacer vos données)
    npm run dev

## Tester l'importation

1. Créez un match avec les équipes « Équipe A » et « Équipe B » (score 2 : 1).
2. Allez dans « Importation des données », choisissez ce match, puis déposez
   `exemples/evenements_exemple.csv` (ou `evenements_exemple_format_different.csv`, qui contient 3 erreurs volontaires).

## Commandes utiles

- `npm run db:reset` (backend) : efface TOUTES les données et recrée le schéma (développement uniquement)
