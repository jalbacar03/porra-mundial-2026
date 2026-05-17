-- BACKUP: Vista leaderboard ANTES de eliminar órdagos (2026-05-17)
-- Para restaurar esta versión:
--   1) Restaurar tablas ordagos / ordago_entries / RPC resolve_ordago (ver archive/ordagos-feature branch)
--   2) Ejecutar este script

DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
SELECT p.id AS user_id,
    p.full_name,
    (((COALESCE(match_stats.total_points, 0::bigint) + COALESCE(pre_tournament.pre_tournament_points, 0::bigint)) + COALESCE(ordago_stats.ordago_points, 0::bigint)) + COALESCE(bracket_stats.bracket_points, 0::bigint)) AS total_points,
    COALESCE(match_stats.exact_hits, 0::bigint) AS exact_hits,
    COALESCE(match_stats.sign_hits, 0::bigint) AS sign_hits,
    COALESCE(match_stats.misses, 0::bigint) AS misses,
    COALESCE(pre_tournament.pre_tournament_points, 0::bigint) AS pre_tournament_points,
    COALESCE(ordago_stats.ordago_points, 0::bigint) AS ordago_points,
    COALESCE(bracket_stats.bracket_points, 0::bigint) AS bracket_points
FROM ((((profiles p
    LEFT JOIN (
        SELECT pred.user_id,
            sum(pred.points_earned) AS total_points,
            count(*) FILTER (WHERE pred.points_earned = 3) AS exact_hits,
            count(*) FILTER (WHERE pred.points_earned = 1) AS sign_hits,
            count(*) FILTER (WHERE pred.points_earned = 0) AS misses
        FROM (predictions pred
            JOIN matches m ON ((m.id = pred.match_id) AND (m.status = 'finished'::text)))
        GROUP BY pred.user_id
    ) match_stats ON match_stats.user_id = p.id)
    LEFT JOIN (
        SELECT pre_tournament_entries.user_id,
            sum(COALESCE(pre_tournament_entries.points_awarded, 0)) AS pre_tournament_points
        FROM pre_tournament_entries
        WHERE pre_tournament_entries.is_resolved = true
        GROUP BY pre_tournament_entries.user_id
    ) pre_tournament ON pre_tournament.user_id = p.id)
    LEFT JOIN (
        SELECT ordago_entries.user_id,
            sum(COALESCE(ordago_entries.points_awarded, 0)) AS ordago_points
        FROM ordago_entries
        WHERE ordago_entries.points_awarded IS NOT NULL
        GROUP BY ordago_entries.user_id
    ) ordago_stats ON ordago_stats.user_id = p.id)
    LEFT JOIN (
        SELECT bracket_picks.user_id,
            sum(COALESCE(bracket_picks.points_awarded, 0)) AS bracket_points
        FROM bracket_picks
        WHERE bracket_picks.points_awarded IS NOT NULL
        GROUP BY bracket_picks.user_id
    ) bracket_stats ON bracket_stats.user_id = p.id);
