-- Milestone 6: GenAI Evaluation with ELO Scoring
-- Stores approach ratings and user preference comparisons

CREATE TABLE IF NOT EXISTS elo_scores (
  id SERIAL PRIMARY KEY,
  approach_name VARCHAR(50) UNIQUE NOT NULL,
  rating NUMERIC(8,2) NOT NULL DEFAULT 1500.00,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  total_comparisons INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS elo_comparisons (
  id BIGSERIAL PRIMARY KEY,
  comparison_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  approach_a VARCHAR(50) NOT NULL,
  approach_b VARCHAR(50) NOT NULL,
  response_a TEXT NOT NULL,
  response_b TEXT NOT NULL,
  winner VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_elo_comparisons_comparison_id ON elo_comparisons(comparison_id);
CREATE INDEX IF NOT EXISTS idx_elo_comparisons_user_id ON elo_comparisons(user_id);

-- Seed the four approaches at default rating
INSERT INTO elo_scores (approach_name) VALUES
  ('concise'),
  ('detailed'),
  ('executive'),
  ('technical')
ON CONFLICT (approach_name) DO NOTHING;
