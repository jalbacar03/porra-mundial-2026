import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'
export const TOP_MEDAL = ['#ffcc00', '#c8ccd4', '#cd8246', '#9a8456', '#9a8456']

/**
 * Devuelve un mapa { matchId: [{ name, medal, cell, ph, pa }] } con lo que ha
 * puesto el TOP 5 ACTUAL de la clasificación en cada partido — solo de rondas ya
 * cerradas (el primer partido de la ronda ya empezó), para no revelar picks de
 * una ronda con el plazo abierto.
 *
 * DINÁMICO: se re-calcula cuando cambian los partidos (Realtime). Así, si al
 * acabar un partido cambia el top 5, el desplegable del siguiente partido ya
 * muestra el top 5 nuevo. `ph`/`pa` = marcador crudo, para marcar 🎯 en vivo.
 */
export function useTopPicks() {
  const [picks, setPicks] = useState({})

  useEffect(() => {
    let alive = true

    async function load() {
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

        const entry = (uid, mid) => {
          const p = predMap[`${uid}|${mid}`]
          const has = p && p.predicted_home != null
          let cell = '—'
          if (has) {
            cell = `${p.predicted_home}-${p.predicted_away}`
            if (p.predicted_home === p.predicted_away && p.predicted_advancer_id) {
              cell += ` ${(teamName[p.predicted_advancer_id] || '').slice(0, 3).toUpperCase()}`
            }
          }
          return { cell, ph: has ? p.predicted_home : null, pa: has ? p.predicted_away : null }
        }
        const out = {}
        for (const mid of closedMatchIds) {
          out[mid] = top5.map((u, i) => ({ name: u.full_name, medal: TOP_MEDAL[i], ...entry(u.user_id, mid) }))
        }
        if (alive) setPicks(out)
      } catch (e) {
        console.error('useTopPicks', e)
      }
    }

    load()
    // Re-calcula al cambiar los partidos (un partido acaba → puede cambiar el top 5).
    const channel = supabase.channel('toppicks-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load())
      .subscribe()

    return () => { alive = false; supabase.removeChannel(channel) }
  }, [])

  return picks
}
