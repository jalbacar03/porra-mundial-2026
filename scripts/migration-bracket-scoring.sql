-- Migration: Add bracket scoring automation
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- 1. Add points_awarded column to bracket_picks
ALTER TABLE bracket_picks ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT NULL;

-- 2. Add winner_team_id to matches (for knockout results)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_team_id BIGINT REFERENCES teams(id) DEFAULT NULL;

-- 3. Recreate leaderboard view to include bracket_points + ordago_points
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id AS user_id,
  p.full_name,
  COALESCE(match_stats.total_points, 0)
    + COALESCE(pre_tournament.pre_tournament_points, 0)
    + COALESCE(ordago_stats.ordago_points, 0)
    + COALESCE(bracket_stats.bracket_points, 0) AS total_points,
  COALESCE(match_stats.exact_hits, 0) AS exact_hits,
  COALESCE(match_stats.sign_hits, 0) AS sign_hits,
  COALESCE(match_stats.misses, 0) AS misses,
  COALESCE(pre_tournament.pre_tournament_points, 0) AS pre_tournament_points,
  COALESCE(ordago_stats.ordago_points, 0) AS ordago_points,
  COALESCE(bracket_stats.bracket_points, 0) AS bracket_points
FROM profiles p
LEFT JOIN (
  SELECT
    pred.user_id,
    SUM(pred.points_earned) AS total_points,
    COUNT(*) FILTER (WHERE pred.points_earned = 3) AS exact_hits,
    COUNT(*) FILTER (WHERE pred.points_earned = 1) AS sign_hits,
    COUNT(*) FILTER (WHERE pred.points_earned = 0) AS misses
  FROM predictions pred
  INNER JOIN matches m ON m.id = pred.match_id AND m.status = 'finished'
  GROUP BY pred.user_id
) match_stats ON match_stats.user_id = p.id
LEFT JOIN (
  SELECT
    user_id,
    SUM(COALESCE(points_awarded, 0)) AS pre_tournament_points
  FROM pre_tournament_entries
  WHERE is_resolved = true
  GROUP BY user_id
) pre_tournament ON pre_tournament.user_id = p.id
LEFT JOIN (
  SELECT
    user_id,
    SUM(COALESCE(points_awarded, 0)) AS ordago_points
  FROM ordago_entries
  WHERE points_awarded IS NOT NULL
  GROUP BY user_id
) ordago_stats ON ordago_stats.user_id = p.id
LEFT JOIN (
  SELECT
    user_id,
    SUM(COALESCE(points_awarded, 0)) AS bracket_points
  FROM bracket_picks
  WHERE points_awarded IS NOT NULL
  GROUP BY user_id
) bracket_stats ON bracket_stats.user_id = p.id;

-- 4. Grant access to the view
GRANT SELECT ON leaderboard TO authenticated, anon;

-- 5. Enable REPLICA IDENTITY FULL on forum_messages
-- (needed for Realtime DELETE events to include all columns for filtering)
ALTER TABLE forum_messages REPLICA IDENTITY FULL;
