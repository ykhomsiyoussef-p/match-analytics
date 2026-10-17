#!/bin/bash
# Sauvegarde quotidienne de la base PostgreSQL (14 jours conservés).
# Les vidéos (/var/lib/match-analytics/videos) doivent être sauvegardées séparément.
set -euo pipefail
DEST=/var/backups/match-analytics
mkdir -p "$DEST"
sudo -u postgres pg_dump match_analytics | gzip > "$DEST/db-$(date +%F).sql.gz"
find "$DEST" -name 'db-*.sql.gz' -mtime +14 -delete
