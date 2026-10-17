import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool, withTransaction } from './pool.js'
import { findOrCreateTeam } from '../services/team.service.js'

// DONNÉES DE DÉMONSTRATION FICTIVES : ce match n'a jamais existé.
const email = process.env.SEED_EMAIL
const password = process.env.SEED_PASSWORD
const fullName = process.env.SEED_NAME || 'Administrateur'

if (!email || !password) {
  console.error('Renseignez SEED_EMAIL et SEED_PASSWORD dans backend/.env avant de lancer le seed.')
  process.exit(1)
}
if (password.length < 10) {
  console.error('SEED_PASSWORD doit contenir au moins 10 caractères.')
  process.exit(1)
}

const minute = (i, k, offset = 3) => ((i * k + offset) % 90) + 1

async function addEvent(client, { matchId, teamId, playerId = null, type, min, outcome = null, x = null, y = null }) {
  const { rows } = await client.query(
    `INSERT INTO match_events
       (match_id, team_id, player_id, event_type, period, match_minute, outcome, x, y, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'demo')
     RETURNING id`,
    [matchId, teamId, playerId, type, min <= 45 ? 1 : 2, min, outcome, x, y]
  )
  return rows[0].id
}

async function seedShots(client, matchId, cfg) {
  const { teamId, side, total, goals, saved } = cfg
  for (let i = 0; i < total; i++) {
    let outcome
    let min = minute(i, 11, 5)
    let playerId = null
    if (i < goals.length) {
      outcome = 'goal'
      min = goals[i].minute
      playerId = goals[i].playerId
    } else if (i < goals.length + saved) {
      outcome = 'saved'
    } else {
      outcome = i % 2 === 0 ? 'off_target' : 'blocked'
    }
    const x = side === 'home' ? 72 + ((i * 3) % 24) : 28 - ((i * 3) % 24)
    const y = 25 + ((i * 13) % 50)
    const eventId = await addEvent(client, { matchId, teamId, playerId, type: 'shot', min, outcome, x, y })
    await client.query('INSERT INTO shots (match_event_id, outcome) VALUES ($1, $2)', [eventId, outcome])
  }
}

async function seedPasses(client, matchId, teamId, total, successful) {
  for (let i = 0; i < total; i++) {
    const success = i < successful
    const eventId = await addEvent(client, {
      matchId,
      teamId,
      type: 'pass',
      min: minute(i, 7),
      outcome: success ? 'success' : 'failed',
      x: (i * 9) % 100,
      y: (i * 17) % 100,
    })
    await client.query('INSERT INTO passes (match_event_id, success) VALUES ($1, $2)', [eventId, success])
  }
}

async function seedSimple(client, matchId, teamId, type, count, outcome = null) {
  for (let i = 0; i < count; i++) {
    await addEvent(client, { matchId, teamId, type, min: minute(i, 13, 7), outcome })
  }
}

try {
  await withTransaction(async (client) => {
    let { rows } = await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email])
    let userId = rows[0]?.id
    if (!userId) {
      const hash = await bcrypt.hash(password, 12)
      ;({ rows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, 'admin') RETURNING id`,
        [email, hash, fullName]
      ))
      userId = rows[0].id
      console.log(`Utilisateur administrateur créé : ${email}`)
    } else {
      console.log(`Utilisateur déjà présent : ${email}`)
    }

    if (process.env.SEED_DEMO === 'false') {
      console.log('Match de démonstration ignoré (SEED_DEMO=false).')
      return
    }

    const existing = await client.query('SELECT 1 FROM matches WHERE is_demo = true LIMIT 1')
    if (existing.rowCount > 0) {
      console.log('Match de démonstration déjà présent : rien à ajouter.')
      return
    }

    const home = await findOrCreateTeam(client, 'FC Démo')
    const away = await findOrCreateTeam(client, 'Atlas Exemple')

    const addPlayer = async (teamId, name, shirt) => {
      const r = await client.query(
        'INSERT INTO players (team_id, full_name, shirt_number) VALUES ($1, $2, $3) RETURNING id',
        [teamId, name, shirt]
      )
      return r.rows[0].id
    }
    const p9 = await addPlayer(home.id, 'Joueur n°9', 9)
    const p7 = await addPlayer(home.id, 'Joueur n°7', 7)
    const p11 = await addPlayer(away.id, 'Joueur n°11', 11)

    ;({ rows } = await client.query(
      `INSERT INTO matches
         (home_team_id, away_team_id, match_date, competition, home_score, away_score,
          analysis_type, is_demo, created_by)
       VALUES ($1, $2, '2026-09-20', 'Match de démonstration', 2, 1, 'globale', true, $3)
       RETURNING id`,
      [home.id, away.id, userId]
    ))
    const matchId = rows[0].id

    await seedShots(client, matchId, {
      teamId: home.id, side: 'home', total: 14, saved: 4,
      goals: [{ minute: 23, playerId: p9 }, { minute: 67, playerId: p7 }],
    })
    await seedShots(client, matchId, {
      teamId: away.id, side: 'away', total: 9, saved: 2,
      goals: [{ minute: 41, playerId: p11 }],
    })
    await seedPasses(client, matchId, home.id, 100, 86)
    await seedPasses(client, matchId, away.id, 100, 79)
    await seedSimple(client, matchId, home.id, 'corner', 6)
    await seedSimple(client, matchId, away.id, 'corner', 3)
    await seedSimple(client, matchId, home.id, 'interception', 9)
    await seedSimple(client, matchId, away.id, 'interception', 12)
    await seedSimple(client, matchId, home.id, 'duel', 52, 'won')
    await seedSimple(client, matchId, away.id, 'duel', 48, 'won')

    console.log('Match de démonstration (fictif) créé.')
  })
} catch (err) {
  console.error('Échec du seed :', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
