-- 016_experiment_logging.sql
-- Adds tables that persist simulated experiment exposures and events
-- so they survive dyno restarts and can be aggregated reliably.

CREATE TABLE IF NOT EXISTS experiment_exposures (
  id BIGSERIAL PRIMARY KEY,
  user_or_session_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_exposures_test ON experiment_exposures(test_id);
CREATE INDEX IF NOT EXISTS idx_experiment_exposures_recorded_at ON experiment_exposures(recorded_at);

CREATE TABLE IF NOT EXISTS experiment_events (
  id BIGSERIAL PRIMARY KEY,
  user_or_session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  test_id TEXT,
  variant TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_events_test ON experiment_events(test_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_event ON experiment_events(event_name);
CREATE INDEX IF NOT EXISTS idx_experiment_events_recorded_at ON experiment_events(recorded_at);
