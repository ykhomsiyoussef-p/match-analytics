// Retrouve une équipe par son nom (sans tenir compte de la casse) ou la crée.
export async function findOrCreateTeam(client, name) {
  const clean = name.trim()
  const find = () => client.query('SELECT id, name FROM teams WHERE lower(name) = lower($1)', [clean])

  let { rows } = await find()
  if (rows[0]) return rows[0]

  try {
    ;({ rows } = await client.query('INSERT INTO teams (name) VALUES ($1) RETURNING id, name', [clean]))
    return rows[0]
  } catch (err) {
    // Une autre requête a créé la même équipe entre-temps.
    if (err.code === '23505') {
      ;({ rows } = await find())
      return rows[0]
    }
    throw err
  }
}
