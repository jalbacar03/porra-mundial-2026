import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
export const TOP_MEDAL = ['#ffcc00', '#c8ccd4', '#cd8246', '#9a8456', '#9a8456']

/**
 * Devuelve un mapa { matchId: [{ name, medal, cell }] } con lo que ha puesto el
 * TOP 5 de la clasificación en cada partido — SOLO de rondas ya cerradas (el
 * primer partido de la ronda ya empezó), para no revelar picks de una ronda con
 * el plazo abierto. Se usa en los banners de partido del Inicio.
 */
export function useTopPicks() {
  const [picks, setPicks] = useState({})

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [lbRes, profRes, matchesRes, teamsRes] = await Promise.all([
          supabase.from('leaderboard').select('user_id, full_name, total_points, exact_hits'),
          supabase.from('profiles').select('id').eq('has_paid', true),
          supabase.from('matches').select('id, stage, match_date').neq('stage', 'group').neq('stage', 'friendly').neq('stage', 'test'),
          supabase.from('teams').select('id, name'),
        ])
        const paid = new Set((profRes.data || []).map(p => p.id))
        const top5 = (lbRes.data || [])
          .filter(r => paid.has(r.user_id) && r.user_id !== BOT365_ID)
          .sort((a, b) => (b.total_points - a.total_points) || ((b.exact_hits || 0) - (a.exact_hits || 0)))
          .slice(0, 5)
        if (!top5.length) return
        const teamName = {}
        ;(teamsRes.data || []).forEach(t => { teamName[t.id] = t.name })

        // Rondas cerradas: primer partido de la ronda ya empezó.
        const now = Date.now()
        const stageFirst = {}
        ;(matchesRes.data || []).forEach(m => {
          if (!m.match_date) return
          const ms = new Date(m.match_date).getTime()
          if (stageFirst[m.stage] == null || ms < stageFirst[m.stage]) stageFirst[m.stage] = ms
        })
        const closedMatchIds = (matchesRes.data || [])
          .filter(m => stageFirst[m.stage] != null && stageFirst[m.stage] <= now)
          .map(m => m.id)
        if (!closedMatchIds.length) return

        const predRes = await supabase.from('predictions')
          .select('user_id, match_id, predicted_home, predicted_away, predicted_advancer_id')
          .in('user_id', top5.map(t => t.user_id))
          .in('match_id', closedMatchIds)
        const predMap = {}
        ;(predRes.data || []).forEach(p => { predMap[`${p.user_id}|${p.match_id}`] = p })

        const cell = (uid, mid) => {
          const p = predMap[`${uid}|${mid}`]
          if (!p || p.predicted_home == null) return '—'
          let s = `${p.predicted_home}-${p.predicted_away}`
          if (p.predicted_home === p.predicted_away && p.predicted_advancer_id) {
            s += ` ${(teamName[p.predicted_advancer_id] || '').slice(0, 3).toUpperCase()}`
          }
          return s
        }
        const out = {}
        for (const mid of closedMatchIds) {
          out[mid] = top5.map((u, i) => ({ name: u.full_name, medal: TOP_MEDAL[i], cell: cell(u.user_id, mid) }))
        }
        if (alive) setPicks(out)
      } catch (e) {
        console.error('useTopPicks', e)
      }
    })()
    return () => { alive = false }
  }, [])

  return picks
}
