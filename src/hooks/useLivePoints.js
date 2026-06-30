import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

/**
 * useLivePoints — tentative points for the current user from matches still
 * in play (status='live').
 *
 * Game-changer behaviour: while a match is live, scores change minute to
 * minute via the API-Football sync. We don't commit these tentative points
 * to the DB (the trigger only does that when status='finished'), but the
 * frontend computes them on the fly and shows them next to the user's
 * confirmed total with a SofaScore-style red blinking "+X".
 *
 * Reads `matches` rows with status='live' and the user's predictions for
 * those matches, then applies the standard 3/1/0 scoring rule. Refreshes:
 *   - immediately on mount,
 *   - on any UPDATE to the matches table (Supabase Realtime),
 *   - and every 30s as fallback in case Realtime drops.
 */
export function useLivePoints(userId) {
  const [state, setState] = useState({ points: 0, matchCount: 0 })

  useEffect(() => {
    if (!userId) return
    let mounted = true

    async function refresh() {
      // Importante: excluir matches stage='friendly' o 'test'. El hero del
      // Dashboard es el del MUNDIAL, no de La Liguilla — sumar puntos de un
      // amistoso aquí confundiría al user (vería "+3 pts del Mundial" durante
      // un partido que NO es del Mundial).
      const { data: liveMatches } = await supabase
        .from('matches')
        .select('id, home_score, away_score, status, stage')
        .eq('status', 'live')
        .not('stage', 'in', '("friendly","test")')

      if (!liveMatches?.length) {
        if (mounted) setState({ points: 0, matchCount: 0 })
        return
      }

      // Provisional por el MISMO RPC que la Clasificación. Imprescindible para no
      // divergir: en GRUPOS es 3/1, pero en ELIMINATORIAS es +2 resultado a 90' +
      // +1 quién avanza (equipo que va ganando) + CC — NO el "+1 por signo" de
      // grupos (un empate en vivo no suma nada hasta que alguien va por delante).
      const { data: provRows } = await supabase.rpc('live_provisional_points')
      const mine = (provRows || []).find(r => r.user_id === userId && r.scope === 'mundial')

      if (mounted) setState({ points: mine?.provisional || 0, matchCount: liveMatches.length })
    }

    refresh()

    const channel = supabase
      .channel('live-points-' + userId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, refresh)
      .subscribe()

    const interval = setInterval(refresh, 30000)

    return () => {
      mounted = false
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [userId])

  return state
}
