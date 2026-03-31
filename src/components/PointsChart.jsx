import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

/**
 * Shows cumulative points over time for the current user.
 * Built from resolved predictions ordered by match_date.
 */
export default function PointsChart({ userId }) {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchPointsHistory()
  }, [userId])

  async function fetchPointsHistory() {
    // Get all resolved predictions with their match dates
    const { data: preds } = await supabase
      .from('predictions')
      .select('points_earned, match_id')
      .eq('user_id', userId)
      .not('points_earned', 'is', null)

    if (!preds || preds.length === 0) {
      setLoading(false)
      return
    }

    // Get match dates for ordering
    const matchIds = preds.map(p => p.match_id)
    const { data: matches } = await supabase
      .from('matches')
      .select('id, match_date')
      .in('id', matchIds)
      .order('match_date', { ascending: true })

    if (!matches) {
      setLoading(false)
      return
    }

    const matchDateMap = {}
    matches.forEach(m => { matchDateMap[m.id] = m.match_date })

    // Build timeline: group by date, accumulate points
    const predsWithDate = preds
      .map(p => ({
        date: matchDateMap[p.match_id],
        points: p.points_earned || 0,
      }))
      .filter(p => p.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Group by day
    const byDay = {}
    predsWithDate.forEach(p => {
      const day = p.date.split('T')[0]
      byDay[day] = (byDay[day] || 0) + p.points
    })

    // Build cumulative
    let cumulative = 0
    const timeline = Object.entries(byDay).map(([day, pts]) => {
      cumulative += pts
      const d = new Date(day)
      return {
        date: `${d.getDate()}/${d.getMonth() + 1}`,
        pts: cumulative,
        dayPts: pts,
      }
    })

    // Also add pre-tournament points at the start if any
    const { data: betEntries } = await supabase
      .from('pre_tournament_entries')
      .select('points_awarded')
      .eq('user_id', userId)
      .eq('is_resolved', true)

    const betPts = (betEntries || []).reduce((s, e) => s + (e.points_awarded || 0), 0)
    if (betPts > 0 && timeline.length > 0) {
      // Add bet points to all entries (they're pre-tournament)
      timeline.forEach(t => { t.pts += betPts })
      timeline.unshift({ date: 'Pre', pts: betPts, dayPts: betPts })
    }

    setChartData(timeline)
    setLoading(false)
  }

  if (loading || chartData.length < 2) return null

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '10px',
      padding: '16px',
      border: '0.5px solid var(--border)',
    }}>
      <div style={{
        fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)',
        marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        📈 Tu progreso
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-dim)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-dim)' }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
            formatter={(value, name) => [value, name === 'pts' ? 'Total' : 'Día']}
            labelStyle={{ color: 'var(--text-muted)', fontSize: '11px' }}
          />
          <Line
            type="monotone"
            dataKey="pts"
            stroke="var(--gold)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--gold)' }}
            activeDot={{ r: 5, fill: 'var(--gold)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
