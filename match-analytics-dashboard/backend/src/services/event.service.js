import { pool } from '../db/pool.js'
import { getMatchFull as getMatch } from './match.service.js'
import { getVideo } from './video.service.js'
import { estimateVideoTime } from '../video/timeline.js'

// Événements du match avec leur temps vidéo (fourni par le CSV, ou estimé d'après les repères de la vidéo).
export async function listVideoEvents(user, matchId, videoId) {
  const match = await getMatch(user, matchId)
  const video = await getVideo(user, matchId, videoId)

  const { rows } = await pool.query(
    `SELECT e.id, e.event_type, e.team_id, e.player_id, pl.full_name AS player_name,
            e.period, e.match_minute, e.match_second, e.video_time_seconds, e.outcome
     FROM match_events e
     LEFT JOIN players pl ON pl.id = e.player_id
     WHERE e.match_id = $1
     ORDER BY e.period, e.match_minute, e.match_second, e.id
     LIMIT 5000`,
    [match.id]
  )

  return rows.map((r) => {
    const time = estimateVideoTime(
      {
        minute: r.match_minute,
        second: r.match_second,
        period: r.period,
        videoTimeSeconds: r.video_time_seconds === null ? null : Number(r.video_time_seconds),
      },
      video
    )
    return {
      id: r.id,
      type: r.event_type,
      teamSide: r.team_id === match.home.id ? 'home' : 'away',
      playerId: r.player_id,
      playerName: r.player_name,
      period: r.period,
      minute: r.match_minute,
      second: r.match_second,
      outcome: r.outcome,
      videoTimeSeconds: time.seconds,
      timeSource: time.source,
    }
  })
}
