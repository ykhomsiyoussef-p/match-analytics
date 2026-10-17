-- Match Analytics Dashboard : schéma PostgreSQL (PostgreSQL 14 ou plus récent).
-- Conventions : identifiants INTEGER auto-générés, dates en TIMESTAMPTZ,
-- coordonnées x/y en pourcentage du terrain (0 à 100), temps vidéo en secondes.

-- ============ Utilisateurs ============
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'analyste', 'entraineur')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

-- ============ Équipes et joueurs ============
CREATE TABLE IF NOT EXISTS teams (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_unique ON teams (lower(name));

CREATE TABLE IF NOT EXISTS players (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id      INTEGER NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  shirt_number SMALLINT CHECK (shirt_number BETWEEN 0 AND 99),
  position     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS players_team_idx ON players (team_id);

-- ============ Matchs ============
CREATE TABLE IF NOT EXISTS matches (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  home_team_id  INTEGER NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
  away_team_id  INTEGER NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
  match_date    DATE NOT NULL,
  competition   TEXT,
  home_score    SMALLINT NOT NULL DEFAULT 0 CHECK (home_score >= 0),
  away_score    SMALLINT NOT NULL DEFAULT 0 CHECK (away_score >= 0),
  analysis_type TEXT NOT NULL DEFAULT 'globale'
                CHECK (analysis_type IN ('globale', 'offensive', 'defensive', 'coups_arretes', 'individuelle')),
  status        TEXT NOT NULL DEFAULT 'en_cours' CHECK (status IN ('en_cours', 'termine')),
  is_demo       BOOLEAN NOT NULL DEFAULT false,
  created_by    INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matches_different_teams CHECK (home_team_id <> away_team_id)
);
CREATE INDEX IF NOT EXISTS matches_created_by_idx ON matches (created_by);
CREATE INDEX IF NOT EXISTS matches_date_idx ON matches (match_date DESC);

-- ============ Vidéos (métadonnées uniquement, jamais le fichier) ============
-- match_start_offset_seconds : instant de la vidéo où commence le match officiel.
-- second_half_start_seconds  : instant de la vidéo où commence la 2e mi-temps.
-- Ces deux champs permettent de convertir temps vidéo <-> minute de jeu.
CREATE TABLE IF NOT EXISTS match_videos (
  id                         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id                   INTEGER NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  storage_key                TEXT NOT NULL UNIQUE,
  original_filename          TEXT NOT NULL,
  mime_type                  TEXT NOT NULL,
  size_bytes                 BIGINT NOT NULL CHECK (size_bytes > 0),
  duration_seconds           NUMERIC(10, 2) CHECK (duration_seconds > 0),
  processing_status          TEXT NOT NULL DEFAULT 'envoi'
                             CHECK (processing_status IN ('envoi', 'envoyee', 'traitement', 'prete', 'erreur')),
  match_start_offset_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (match_start_offset_seconds >= 0),
  second_half_start_seconds  NUMERIC(10, 2) CHECK (second_half_start_seconds >= 0),
  uploaded_by                INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_videos_id_match_unique UNIQUE (id, match_id)
);
CREATE INDEX IF NOT EXISTS match_videos_match_idx ON match_videos (match_id);

-- ============ Événements de match (importés par CSV ou saisis à la main) ============
-- period : 1 et 2 = mi-temps, 3 et 4 = prolongations, 5 = tirs au but.
-- match_minute/match_second = temps de jeu officiel ; video_time_seconds = temps dans la vidéo.
CREATE TABLE IF NOT EXISTS match_events (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id           INTEGER NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  team_id            INTEGER NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
  player_id          INTEGER REFERENCES players (id) ON DELETE SET NULL,
  video_id           INTEGER REFERENCES match_videos (id) ON DELETE SET NULL,
  event_type         TEXT NOT NULL
                     CHECK (event_type IN ('shot', 'pass', 'corner', 'interception', 'duel', 'tactical', 'other')),
  period             SMALLINT NOT NULL DEFAULT 1 CHECK (period BETWEEN 1 AND 5),
  match_minute       SMALLINT NOT NULL CHECK (match_minute BETWEEN 0 AND 130),
  match_second       SMALLINT NOT NULL DEFAULT 0 CHECK (match_second BETWEEN 0 AND 59),
  video_time_seconds NUMERIC(10, 2) CHECK (video_time_seconds >= 0),
  x                  NUMERIC(5, 2) CHECK (x BETWEEN 0 AND 100),
  y                  NUMERIC(5, 2) CHECK (y BETWEEN 0 AND 100),
  outcome            TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  source             TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('csv', 'manual', 'demo')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_events_match_type_idx ON match_events (match_id, event_type);
CREATE INDEX IF NOT EXISTS match_events_match_team_idx ON match_events (match_id, team_id);
CREATE INDEX IF NOT EXISTS match_events_video_time_idx ON match_events (video_id, video_time_seconds);
CREATE INDEX IF NOT EXISTS match_events_player_idx ON match_events (player_id);

-- Détails propres aux tirs. Un but est un tir dont outcome = 'goal'.
CREATE TABLE IF NOT EXISTS shots (
  match_event_id INTEGER PRIMARY KEY REFERENCES match_events (id) ON DELETE CASCADE,
  outcome        TEXT NOT NULL CHECK (outcome IN ('goal', 'saved', 'blocked', 'off_target', 'post')),
  on_target      BOOLEAN GENERATED ALWAYS AS (outcome IN ('goal', 'saved')) STORED,
  xg             NUMERIC(4, 3) CHECK (xg BETWEEN 0 AND 1),
  body_part      TEXT CHECK (body_part IN ('right_foot', 'left_foot', 'head', 'other')),
  end_x          NUMERIC(5, 2) CHECK (end_x BETWEEN 0 AND 100),
  end_y          NUMERIC(5, 2) CHECK (end_y BETWEEN 0 AND 100)
);

-- Détails propres aux passes.
CREATE TABLE IF NOT EXISTS passes (
  match_event_id      INTEGER PRIMARY KEY REFERENCES match_events (id) ON DELETE CASCADE,
  success             BOOLEAN NOT NULL,
  is_key_pass         BOOLEAN NOT NULL DEFAULT false,
  recipient_player_id INTEGER REFERENCES players (id) ON DELETE SET NULL,
  end_x               NUMERIC(5, 2) CHECK (end_x BETWEEN 0 AND 100),
  end_y               NUMERIC(5, 2) CHECK (end_y BETWEEN 0 AND 100)
);

-- ============ Annotations vidéo ============
-- La clé étrangère composée (video_id, match_id) garantit que l'annotation
-- appartient bien à une vidéo DU MÊME match.
CREATE TABLE IF NOT EXISTS video_annotations (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id           INTEGER NOT NULL,
  video_id           INTEGER NOT NULL,
  team_id            INTEGER NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
  player_id          INTEGER REFERENCES players (id) ON DELETE SET NULL,
  category           TEXT NOT NULL CHECK (category IN (
                       'but', 'tir', 'passe_cle', 'organisation_offensive', 'organisation_defensive',
                       'transition_offensive', 'transition_defensive', 'coup_de_pied_arrete',
                       'erreur_individuelle', 'point_fort', 'point_a_ameliorer', 'commentaire_libre')),
  title              TEXT NOT NULL,
  description        TEXT,
  start_time_seconds NUMERIC(10, 2) NOT NULL CHECK (start_time_seconds >= 0),
  end_time_seconds   NUMERIC(10, 2),
  author_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT annotation_time_order CHECK (end_time_seconds IS NULL OR end_time_seconds >= start_time_seconds),
  CONSTRAINT annotation_video_match_fk FOREIGN KEY (video_id, match_id)
    REFERENCES match_videos (id, match_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS annotations_video_time_idx ON video_annotations (video_id, start_time_seconds);
CREATE INDEX IF NOT EXISTS annotations_match_category_idx ON video_annotations (match_id, category);

-- ============ Clips ============
CREATE TABLE IF NOT EXISTS video_clips (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id           INTEGER NOT NULL,
  video_id           INTEGER NOT NULL,
  annotation_id      INTEGER REFERENCES video_annotations (id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  category           TEXT NOT NULL CHECK (category IN (
                       'but', 'tir', 'passe_cle', 'organisation_offensive', 'organisation_defensive',
                       'transition_offensive', 'transition_defensive', 'coup_de_pied_arrete',
                       'erreur_individuelle', 'point_fort', 'point_a_ameliorer', 'commentaire_libre')),
  start_time_seconds NUMERIC(10, 2) NOT NULL CHECK (start_time_seconds >= 0),
  end_time_seconds   NUMERIC(10, 2) NOT NULL,
  status             TEXT NOT NULL DEFAULT 'selection'
                     CHECK (status IN ('selection', 'traitement', 'pret', 'erreur')),
  storage_key        TEXT UNIQUE,
  created_by         INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clip_time_order CHECK (end_time_seconds > start_time_seconds),
  CONSTRAINT clip_video_match_fk FOREIGN KEY (video_id, match_id)
    REFERENCES match_videos (id, match_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS clips_match_idx ON video_clips (match_id);

-- Joueurs concernés par un clip.
CREATE TABLE IF NOT EXISTS clip_players (
  clip_id   INTEGER NOT NULL REFERENCES video_clips (id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  PRIMARY KEY (clip_id, player_id)
);

-- ============ Rapports d'analyse ============
CREATE TABLE IF NOT EXISTS analysis_reports (
  id                     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id               INTEGER NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  author_id              INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status                 TEXT NOT NULL DEFAULT 'brouillon'
                         CHECK (status IN ('brouillon', 'en_validation', 'valide', 'partage')),
  summary                TEXT,
  strengths              TEXT,
  weaknesses             TEXT,
  tactical_issues        TEXT,
  individual_performances TEXT,
  recommendations        TEXT,
  validated_by           INTEGER REFERENCES users (id) ON DELETE SET NULL,
  validated_at           TIMESTAMPTZ,
  shared_at              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_match_idx ON analysis_reports (match_id);
CREATE INDEX IF NOT EXISTS reports_author_idx ON analysis_reports (author_id);

-- Associe une observation du rapport à une annotation OU à un clip (exactement un des deux).
CREATE TABLE IF NOT EXISTS report_links (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id     INTEGER NOT NULL REFERENCES analysis_reports (id) ON DELETE CASCADE,
  section       TEXT NOT NULL CHECK (section IN (
                  'resume', 'points_forts', 'faiblesses', 'problemes_tactiques',
                  'performances_individuelles', 'recommandations')),
  annotation_id INTEGER REFERENCES video_annotations (id) ON DELETE CASCADE,
  clip_id       INTEGER REFERENCES video_clips (id) ON DELETE CASCADE,
  CONSTRAINT report_link_one_target CHECK ((annotation_id IS NOT NULL)::int + (clip_id IS NOT NULL)::int = 1)
);
CREATE INDEX IF NOT EXISTS report_links_report_idx ON report_links (report_id);

-- Partage d'un rapport avec des utilisateurs précis (et droit de commenter).
CREATE TABLE IF NOT EXISTS report_shares (
  report_id   INTEGER NOT NULL REFERENCES analysis_reports (id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  can_comment BOOLEAN NOT NULL DEFAULT false,
  shared_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);

CREATE TABLE IF NOT EXISTS report_comments (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id  INTEGER NOT NULL REFERENCES analysis_reports (id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  body       TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_comments_report_idx ON report_comments (report_id);

-- ============ Journal des opérations sensibles ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   INTEGER,
  ip          TEXT,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at);

-- ============ Historique des importations CSV ============
-- Chaque import est un « lot » : on peut l'annuler en supprimant ses événements.
CREATE TABLE IF NOT EXISTS import_batches (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id      INTEGER NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
  imported_by   INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  file_name     TEXT,
  total_rows    INTEGER NOT NULL CHECK (total_rows >= 0),
  imported_rows INTEGER NOT NULL CHECK (imported_rows >= 0),
  skipped_rows  INTEGER NOT NULL DEFAULT 0 CHECK (skipped_rows >= 0),
  error_rows    INTEGER NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS import_batches_match_idx ON import_batches (match_id);

ALTER TABLE match_events
  ADD COLUMN IF NOT EXISTS import_batch_id INTEGER REFERENCES import_batches (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS match_events_batch_idx ON match_events (import_batch_id);

-- ============ Clips : message d'erreur du traitement vidéo ============
ALTER TABLE video_clips ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ============ Sessions : invalidées à chaque changement de mot de passe ============
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now();
