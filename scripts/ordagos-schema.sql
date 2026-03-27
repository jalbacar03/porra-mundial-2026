-- =============================================
-- ÓRDAGOS — Schema + Seed Data
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Ordagos table (the 6 predefined órdagos)
CREATE TABLE IF NOT EXISTS ordagos (
  id SERIAL PRIMARY KEY,
  number INT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  match_id BIGINT REFERENCES matches(id),  -- NULL until admin assigns a specific match
  cost INT NOT NULL DEFAULT 0,
  reward_exact INT NOT NULL,
  reward_sign INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'open', 'closed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ordago entries (user predictions)
CREATE TABLE IF NOT EXISTS ordago_entries (
  id SERIAL PRIMARY KEY,
  ordago_id INT NOT NULL REFERENCES ordagos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  predicted_home INT NOT NULL,
  predicted_away INT NOT NULL,
  points_awarded INT,  -- NULL until resolved
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ordago_id, user_id)
);

-- 3. RLS
ALTER TABLE ordagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordago_entries ENABLE ROW LEVEL SECURITY;

-- Everyone can read ordagos
CREATE POLICY "Anyone can read ordagos"
  ON ordagos FOR SELECT
  USING (true);

-- Admins can manage ordagos (update status, assign match_id)
CREATE POLICY "Admins can manage ordagos"
  ON ordagos FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Everyone can read all ordago entries (transparency after resolution)
CREATE POLICY "Anyone can read ordago entries"
  ON ordago_entries FOR SELECT
  USING (true);

-- Users can insert their own entries
CREATE POLICY "Users can insert own ordago entries"
  ON ordago_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own entries
CREATE POLICY "Users can update own ordago entries"
  ON ordago_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can update any entry (for resolving/scoring)
CREATE POLICY "Admins can update ordago entries"
  ON ordago_entries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- 4. Seed the 6 órdagos
INSERT INTO ordagos (number, title, description, cost, reward_exact, reward_sign, status) VALUES
  (1, 'España (1er partido)', 'Primer partido de la selección española en el Mundial', 0, 2, 1, 'locked'),
  (2, 'Mejor partido J3', 'El mejor partido de la última jornada de fase de grupos', 1, 3, 2, 'locked'),
  (3, 'Un dieciseisavo', 'Un partido de dieciseisavos de final', 1, 3, 2, 'locked'),
  (4, 'Un octavo de final', 'Un partido de octavos de final', 2, 6, 4, 'locked'),
  (5, 'Un cuarto de final', 'Un partido de cuartos de final', 2, 6, 4, 'locked'),
  (6, 'Una semifinal', 'Un partido de semifinales', 3, 9, 6, 'locked')
ON CONFLICT (number) DO NOTHING;

-- 5. Function to resolve an órdago and calculate points
CREATE OR REPLACE FUNCTION resolve_ordago(p_ordago_id INT)
RETURNS void AS $$
DECLARE
  v_ordago RECORD;
  v_match RECORD;
  v_entry RECORD;
  v_real_sign TEXT;
  v_pred_sign TEXT;
  v_points INT;
BEGIN
  -- Get the ordago with its match
  SELECT o.*, m.home_score, m.away_score, m.status as match_status
  INTO v_ordago
  FROM ordagos o
  JOIN matches m ON o.match_id = m.id
  WHERE o.id = p_ordago_id;

  IF v_ordago IS NULL OR v_ordago.match_status != 'finished' THEN
    RAISE EXCEPTION 'Ordago not found or match not finished';
  END IF;

  -- Calculate sign of real result
  IF v_ordago.home_score > v_ordago.away_score THEN v_real_sign := '1';
  ELSIF v_ordago.home_score < v_ordago.away_score THEN v_real_sign := '2';
  ELSE v_real_sign := 'X';
  END IF;

  -- Process each entry
  FOR v_entry IN SELECT * FROM ordago_entries WHERE ordago_id = p_ordago_id LOOP
    -- Calculate predicted sign
    IF v_entry.predicted_home > v_entry.predicted_away THEN v_pred_sign := '1';
    ELSIF v_entry.predicted_home < v_entry.predicted_away THEN v_pred_sign := '2';
    ELSE v_pred_sign := 'X';
    END IF;

    -- Determine points
    IF v_entry.predicted_home = v_ordago.home_score AND v_entry.predicted_away = v_ordago.away_score THEN
      -- Exact match
      v_points := v_ordago.reward_exact - v_ordago.cost;
    ELSIF v_real_sign = v_pred_sign THEN
      -- Correct sign (1X2)
      v_points := v_ordago.reward_sign - v_ordago.cost;
    ELSE
      -- Miss
      v_points := -v_ordago.cost;
    END IF;

    -- Update entry
    UPDATE ordago_entries SET points_awarded = v_points, updated_at = now()
    WHERE id = v_entry.id;
  END LOOP;

  -- Mark ordago as resolved
  UPDATE ordagos SET status = 'resolved' WHERE id = p_ordago_id;

  -- Auto-unlock the next ordago
  UPDATE ordagos SET status = 'open'
  WHERE number = v_ordago.number + 1 AND status = 'locked';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
