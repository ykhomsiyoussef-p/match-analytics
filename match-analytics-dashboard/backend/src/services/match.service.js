import { pool, withTransaction } from '../db/pool.js'
import { HttpError } from '../utils/httpError.js'
import { findOrCreateTeam } from './team.service.js'
import { logAudit } from './audit.service.js'

const MATCH_SELECT = `
  SELECT m.id,
         to_char(m.match_date, 'YYYY-MM-DD') AS match_date,
         m.competition, m.analysis_type, m.status, m.is_demo,
         m.home_score, m.away_score,
         CASE WHEN $1::text = 'admin' OR m.created_by = $2 THEN 'full' ELSE 'shared' END AS access,
         ht.id AS home_id, ht.name AS home_name,
         aw.id AS away_id, aw.name AS away_name
  FROM matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams aw ON aw.id = m.away_team_id`

// Règles d'accès à un match :
// - l'administrateur voit tout, l'analyste voit ses propres matchs (accès « full ») ;
// - une personne avec laquelle un rapport a été PARTAGÉ voit ce match en lecture (accès « shared » :
//   statistiques et rapport, mais ni la vidéo complète, ni les imports, ni les annotations).
const ACCESS_FILTER = `($1::text = 'admin' OR m.created_by = $2 OR EXISTS (
    SELECT 1 FROM analysis_reports r
    JOIN report_shares s ON s.report_id = r.id
    WHERE r.match_id = m.id AND r.status = 'partage' AND s.user_id = $2))`

const toMatch = (row) => ({
  id: row.id,
  matchDate: row.match_date,
  competition: row.competition,
  analysisType: row.analysis_type,
  status: row.status,
  isDemo: row.is_demo,
  access: row.access,
  homeScore: row.home_score,
  awayScore: row.away_score,
  home: { id: row.home_id, name: row.home_name },
  away: { id: row.away_id, name: row.away_name },
})

export async function listMatches(user) {
  const { rows } = await pool.query(
    `${MATCH_SELECT} WHERE ${ACCESS_FILTER} ORDER BY m.match_date DESC, m.id DESC`,
    [user.role, user.id]
  )
  return rows.map(toMatch)
}

export async function getMatch(user, id, db = pool) {
  const { rows } = await db.query(`${MATCH_SELECT} WHERE ${ACCESS_FILTER} AND m.id = $3`, [
    user.role,
    user.id,
    id,
  ])
  // 404 aussi quand le match existe mais n'est pas accessible : on ne révèle rien.
  if (!rows[0]) throw new HttpError(404, 'Match introuvable')
  return toMatch(rows[0])
}

// Accès complet exigé (vidéo, annotations, imports, clips) : refuse les accès en lecture seule.
export async function getMatchFull(user, id, db = pool) {
  const match = await getMatch(user, id, db)
  if (match.access !== 'full') throw new HttpError(403, 'Accès réservé à l\'analyste de ce match')
  return match
}

export async function createMatch(user, input, ip) {
  return withTransaction(async (client) => {
    const home = await findOrCreateTeam(client, input.homeTeamName)
    const away = await findOrCreateTeam(client, input.awayTeamName)

    const { rows } = await client.query(
      `INSERT INTO matches
         (home_team_id, away_team_id, match_date, competition, home_score, away_score, analysis_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        home.id,
        away.id,
        input.matchDate,
        input.competition || null,
        input.homeScore,
        input.awayScore,
        input.analysisType,
        user.id,
      ]
    )
    const matchId = rows[0].id
    await logAudit({ client, userId: user.id, action: 'match_created', entityType: 'match', entityId: matchId, ip })
    return getMatch(user, matchId, client)
  })
}

const EMPTY_TEAM_STATS = {
  shots: 0,
  shots_on_target: 0,
  xg: null,
  passes: 0,
  passes_ok: 0,
  corners: 0,
  duels: 0,
  duels_won: 0,
  interceptions: 0,
}

// Statistiques calculées UNIQUEMENT à partir des événements enregistrés.
// Une statistique sans donnée source vaut null : on ne fabrique jamais de chiffre.
export async function getMatchDashboard(user, id) {
  const match = await getMatch(user, id)

  const statsResult = await pool.query(
    `SELECT e.team_id,
            (COUNT(*) FILTER (WHERE e.event_type = 'shot'))::int AS shots,
            (COUNT(*) FILTER (WHERE e.event_type = 'shot' AND s.on_target))::int AS shots_on_target,
            SUM(s.xg) FILTER (WHERE e.event_type = 'shot') AS xg,
            (COUNT(*) FILTER (WHERE e.event_type = 'pass'))::int AS passes,
            (COUNT(*) FILTER (WHERE e.event_type = 'pass' AND p.success))::int AS passes_ok,
            (COUNT(*) FILTER (WHERE e.event_type = 'corner'))::int AS corners,
            (COUNT(*) FILTER (WHERE e.event_type = 'duel'))::int AS duels,
            (COUNT(*) FILTER (WHERE e.event_type = 'duel' AND e.outcome = 'won'))::int AS duels_won,
            (COUNT(*) FILTER (WHERE e.event_type = 'interception'))::int AS interceptions
     FROM match_events e
     LEFT JOIN shots s ON s.match_event_id = e.id
     LEFT JOIN passes p ON p.match_event_id = e.id
     WHERE e.match_id = $1
     GROUP BY e.team_id`,
    [match.id]
  )

  const byTeam = new Map(statsResult.rows.map((r) => [r.team_id, r]))
  const h = byTeam.get(match.home.id) ?? EMPTY_TEAM_STATS
  const a = byTeam.get(match.away.id) ?? EMPTY_TEAM_STATS

  const pair = (home, away, available) => (available ? { home, away } : null)
  const total = (key) => h[key] + a[key]
  const pct = (ok, all) => (all > 0 ? Math.round((ok / all) * 100) : 0)
  const xgOf = (row) => (row.xg === null ? 0 : Number(Number(row.xg).toFixed(2)))

  const stats = {
    possession: null, // aucune source de données pour l'instant
    shots: pair(h.shots, a.shots, total('shots') > 0),
    shotsOnTarget: pair(h.shots_on_target, a.shots_on_target, total('shots') > 0),
    xg: pair(xgOf(h), xgOf(a), h.xg !== null || a.xg !== null),
    passAccuracy: pair(pct(h.passes_ok, h.passes), pct(a.passes_ok, a.passes), total('passes') > 0),
    corners: pair(h.corners, a.corners, total('corners') > 0),
    duelsWon: pair(h.duels_won, a.duels_won, total('duels') > 0),
    interceptions: pair(h.interceptions, a.interceptions, total('interceptions') > 0),
  }

  const goalsResult = await pool.query(
    `SELECT e.team_id, e.match_minute, pl.full_name AS player_name
     FROM match_events e
     JOIN shots s ON s.match_event_id = e.id
     LEFT JOIN players pl ON pl.id = e.player_id
     WHERE e.match_id = $1 AND e.event_type = 'shot' AND s.outcome = 'goal'
     ORDER BY e.period, e.match_minute, e.match_second, e.id`,
    [match.id]
  )
  const goals = goalsResult.rows.map((r) => ({
    minute: r.match_minute,
    team: r.team_id === match.home.id ? 'home' : 'away',
    player: r.player_name,
  }))

  return { match, stats, goals }
}

// Joueurs des deux équipes (créés par les imports CSV), pour les formulaires.
export async function getRoster(user, id) {
  const match = await getMatch(user, id)
  const { rows } = await pool.query(
    `SELECT id, team_id, full_name, shirt_number
     FROM players WHERE team_id = ANY($1::int[])
     ORDER BY shirt_number NULLS LAST, full_name`,
    [[match.home.id, match.away.id]]
  )
  const playersOf = (teamId) =>
    rows
      .filter((r) => r.team_id === teamId)
      .map((r) => ({ id: r.id, fullName: r.full_name, shirtNumber: r.shirt_number }))
  return {
    home: { id: match.home.id, name: match.home.name, players: playersOf(match.home.id) },
    away: { id: match.away.id, name: match.away.name, players: playersOf(match.away.id) },
  }
}

const num = (v) => (v === null || v === undefined ? null : Number(v))

// Tous les événements du match avec leurs détails (tirs, passes). Les statistiques et les cartes
// sont calculées à partir de ces données : rien n'est inventé, une valeur absente reste null.
export async function getMatchDataset(user, id) {
  const match = await getMatch(user, id)
  const { rows } = await pool.query(
    `SELECT e.id, e.event_type, e.team_id, e.player_id, e.period, e.match_minute, e.match_second,
            e.outcome, e.x, e.y,
            COALESCE(s.end_x, p.end_x) AS end_x, COALESCE(s.end_y, p.end_y) AS end_y,
            s.xg, s.on_target, s.body_part, p.success, p.is_key_pass
     FROM match_events e
     LEFT JOIN shots s ON s.match_event_id = e.id
     LEFT JOIN passes p ON p.match_event_id = e.id
     WHERE e.match_id = $1
     ORDER BY e.period, e.match_minute, e.match_second, e.id
     LIMIT 20000`,
    [match.id]
  )
  const events = rows.map((r) => ({
    id: r.id,
    type: r.event_type,
    side: r.team_id === match.home.id ? 'home' : 'away',
    playerId: r.player_id,
    period: r.period,
    minute: r.match_minute,
    second: r.match_second,
    outcome: r.outcome,
    x: num(r.x),
    y: num(r.y),
    endX: num(r.end_x),
    endY: num(r.end_y),
    xg: num(r.xg),
    onTarget: r.on_target,
    bodyPart: r.body_part,
    passSuccess: r.success,
    keyPass: r.is_key_pass,
  }))
  return { match, events, truncated: rows.length === 20000 }
}
