-- Milestone 7: Prompt Injection Defense
-- Audit log for prompt injection guard decisions

CREATE TABLE IF NOT EXISTS prompt_guard_log (
  id BIGSERIAL PRIMARY KEY,
  detection_id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  field_path TEXT NOT NULL,
  input_hash CHAR(64) NOT NULL,
  input_preview TEXT NOT NULL,
  input_length INT NOT NULL,
  verdict TEXT NOT NULL,
  layer INT,
  rule_matched TEXT,
  llm_reason TEXT,
  latency_ms INT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_guard_log_detection_id ON prompt_guard_log(detection_id);
CREATE INDEX IF NOT EXISTS idx_prompt_guard_log_user_id ON prompt_guard_log(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_guard_log_verdict ON prompt_guard_log(verdict);
CREATE INDEX IF NOT EXISTS idx_prompt_guard_log_created_at ON prompt_guard_log(created_at DESC);
