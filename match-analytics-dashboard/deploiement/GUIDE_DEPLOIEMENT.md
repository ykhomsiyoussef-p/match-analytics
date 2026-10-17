# Mettre Match Analytics en ligne (serveur public)

Ce guide installe l'application sur **un serveur Ubuntu 24.04** avec **HTTPS automatique** (Caddy),
la base **PostgreSQL** et l'API qui redémarre toute seule. Comptez 1 à 2 heures la première fois.

> Les commandes `sudo ...` se tapent sur le serveur. Les blocs marqués « Sur ton PC » se tapent dans PowerShell.

## 0. Ce qu'il faut

- **Un serveur privé virtuel (VPS)** sous Ubuntu 24.04, chez l'hébergeur de ton choix.
  Prévois au moins 2 Go de mémoire, et un disque assez grand : une vidéo de match pèse souvent plusieurs Go.
- **Un nom de domaine** (ou un sous-domaine) avec un enregistrement DNS de type **A** qui pointe vers l'adresse IP du serveur.
  Sans domaine, pas de certificat HTTPS.
- Un accès SSH : `ssh utilisateur@IP_DU_SERVEUR` dans PowerShell.

Pourquoi un VPS et pas un hébergement gratuit ? Les vidéos sont enregistrées sur le disque du serveur.
La plupart des plateformes gratuites ont un disque temporaire, qui efface les fichiers à chaque redémarrage.
Elles demanderaient un stockage S3, qui n'est pas encore développé.

## 1. Préparer le serveur

```
sudo apt update && sudo apt upgrade -y
sudo apt install -y unzip ufw curl
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Seuls SSH, HTTP et HTTPS sont ouverts. Les ports 4000 (API) et 5432 (base) ne doivent **jamais** être ouverts.

## 2. Installer Node.js, PostgreSQL et Caddy

**Node.js 24 (version LTS, support de longue durée)**. Les dépôts d'Ubuntu 24.04 ne proposent que Node.js 22 : on passe par NodeSource.

```
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

**PostgreSQL** et **FFmpeg** (FFmpeg découpe les clips vidéo) :

```
sudo apt install -y postgresql ffmpeg
```

**Caddy** (commandes officielles de caddyserver.com/docs/install) :

```
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

## 3. Créer la base de données

Génère un mot de passe (lettres et chiffres) avec `openssl rand -hex 16` et note-le, puis :

```
sudo -u postgres psql -c "CREATE USER matchapp WITH PASSWORD 'MOT_DE_PASSE_BASE';"
sudo -u postgres psql -c "CREATE DATABASE match_analytics OWNER matchapp;"
```

## 4. Envoyer le projet

**Sur ton PC**, dans le dossier qui contient le zip :

```
scp match-analytics-dashboard-etape8.zip UTILISATEUR@IP_DU_SERVEUR:~/
```

**Sur le serveur** :

```
sudo mkdir -p /opt/match-analytics /var/lib/match-analytics/videos
sudo adduser --system --group --home /opt/match-analytics matchapp
unzip -q ~/match-analytics-dashboard-etape8.zip -d /tmp/ma
sudo cp -r /tmp/ma/match-analytics-dashboard/. /opt/match-analytics/
sudo chown -R matchapp:matchapp /opt/match-analytics /var/lib/match-analytics
rm -rf /tmp/ma
```

## 5. Configurer et initialiser le backend

```
cd /opt/match-analytics/backend
sudo -H -u matchapp npm install --omit=dev
sudo -H -u matchapp cp .env.production.example .env
sudo chmod 600 .env
sudo -H -u matchapp nano .env
```

Dans `.env`, renseigne :

- `CORS_ORIGIN` : `https://ton-domaine.com`
- `DATABASE_URL` : remplace `MOT_DE_PASSE_BASE` par le mot de passe de l'étape 3
- `JWT_SECRET` : génère-le avec `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `SEED_EMAIL` et `SEED_PASSWORD` : ton compte administrateur, avec un mot de passe long et unique

Puis crée toutes les tables et ton compte administrateur :

```
sudo -H -u matchapp npm run db:migrate
sudo -H -u matchapp npm run db:seed
```

Une fois le compte créé, **efface le mot de passe du fichier** : `sudo -H -u matchapp nano .env` puis laisse `SEED_PASSWORD=` vide.

L'application refuse de démarrer en production si `CORS_ORIGIN` n'est pas en HTTPS ou si le mot de passe de la base est `postgres`.

## 6. Publier le site (frontend)

**Sur ton PC**, dans le dossier `frontend` :

```
npm install
npm run build
scp -r dist UTILISATEUR@IP_DU_SERVEUR:/tmp/
```

**Sur le serveur** :

```
sudo mkdir -p /var/www/match-analytics
sudo cp -r /tmp/dist/. /var/www/match-analytics/
rm -rf /tmp/dist
```

## 7. Démarrer l'API

```
sudo cp /opt/match-analytics/deploiement/match-analytics.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now match-analytics
sudo systemctl status match-analytics
curl http://127.0.0.1:4000/api/health
```

La dernière commande doit répondre `{"status":"ok","database":"ok"}`. L'API redémarre toute seule après un plantage
ou un redémarrage du serveur.

## 8. Activer HTTPS avec Caddy

```
sudo cp /opt/match-analytics/deploiement/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/VOTRE-DOMAINE.COM/ton-domaine.com/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy obtient le certificat en quelques secondes. Pour cela, le DNS doit déjà pointer vers le serveur
et les ports 80 et 443 doivent être ouverts.

## 9. Vérifier

1. `https://ton-domaine.com/api/health` affiche `ok`.
2. `https://ton-domaine.com` affiche la page de connexion. Connecte-toi avec `SEED_EMAIL`.
3. Crée un match, importe un CSV, envoie une petite vidéo et pose une annotation.

## 10. Mettre à jour plus tard

Envoie le nouveau zip comme à l'étape 4, puis :

```
cd /opt/match-analytics/backend
sudo -H -u matchapp npm install --omit=dev
sudo -H -u matchapp npm run db:migrate
sudo systemctl restart match-analytics
```

Reconstruis et renvoie le site (étape 6). Avant de copier `dist`, vide l'ancien : `sudo rm -rf /var/www/match-analytics/*`.
Ton `.env` et tes vidéos ne sont pas touchés, car ils sont hors du zip.

## 11. Sauvegardes (indispensable)

**Base de données**, tous les jours à 3 h 30 :

```
sudo chmod +x /opt/match-analytics/deploiement/sauvegarde.sh
sudo crontab -e
```

Ajoute la ligne : `30 3 * * * /opt/match-analytics/deploiement/sauvegarde.sh`

Les sauvegardes sont dans `/var/backups/match-analytics`. Pour restaurer :
`gunzip -c db-AAAA-MM-JJ.sql.gz | sudo -H -u postgres psql match_analytics`

**Vidéos et clips** : le dossier `/var/lib/match-analytics/videos` n'est pas inclus (les clips peuvent être régénérés depuis la vidéo d'origine). Active les sauvegardes
ou instantanés (snapshots) de ton hébergeur, ou copie ce dossier régulièrement ailleurs.
Une sauvegarde qui reste sur le même serveur ne protège pas contre la perte du serveur.

## 12. Dépannage

| Symptôme | Piste |
| --- | --- |
| Erreur 502 sur le site | L'API est arrêtée : `sudo systemctl status match-analytics` |
| L'API ne démarre pas | `sudo journalctl -u match-analytics -n 50` (le message nomme la variable `.env` en cause) |
| Pas de certificat HTTPS | DNS pas encore propagé, ou ports 80 et 443 fermés : `sudo journalctl -u caddy -n 50` |
| Page blanche | `dist` mal copié : `ls /var/www/match-analytics` doit montrer `index.html` et `assets` |
| Envoi de vidéo en erreur | Disque plein (`df -h`) ou dossier `/var/lib/match-analytics/videos` sans droits |

## Inviter d'autres personnes

Une fois en ligne, connecte-toi avec le compte administrateur, puis ouvre **Paramètres** :

- **Créer un compte** : nom, adresse e-mail, rôle et mot de passe provisoire (10 caractères minimum). Transmets le mot de passe par un canal sûr, et demande à la personne de le changer dans « Paramètres ».
- **Rôles** : l'**entraîneur** ne voit que les rapports partagés avec lui, les statistiques des matchs concernés et les clips joints à ces rapports. Il ne voit jamais la vidéo complète, ni les imports, ni les annotations. L'**analyste** gère ses propres matchs, vidéos, clips et rapports. L'**administrateur** voit tout et gère les comptes.
- **Partager un rapport** : rédige-le, soumets-le, fais-le valider par un administrateur, choisis les destinataires, puis clique sur « Partager le rapport ».
- Désactiver un compte ou réinitialiser son mot de passe le déconnecte immédiatement.

## Avant de l'utiliser avec des données réelles

- **Données personnelles et droits** : les vidéos et statistiques concernent des joueurs, parfois mineurs.
  Obtiens les autorisations nécessaires (joueurs, parents, club) et renseigne-toi sur les obligations
  de déclaration auprès de la CNDP (loi 09-08 au Maroc) avant de les héberger en ligne.
- **Mots de passe** : pas de double authentification. Exige des mots de passe longs et uniques.
- **Vidéos sur le disque du serveur** : pas de quota par utilisateur, pas d'analyse antivirus. Surveille l'espace disque (`df -h`).
- **Sauvegardes** : vérifie qu'une restauration fonctionne réellement (étape 11), au moins une fois.
- **Mises à jour de sécurité** : lance régulièrement `sudo apt update && sudo apt upgrade -y`, et `npm audit` dans le dossier `backend`.
- **Tests** : `npm test` (dans `backend` et dans `frontend`) vérifie les règles principales avant chaque mise à jour.
