-- Scheduled Reports Migration
-- This migration adds support for automated scheduled reports

-- Scheduled reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Report configuration
  report_type VARCHAR(50) NOT NULL, -- 'performance_summary', 'platform_comparison', 'budget_report', 'custom'
  frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  day_of_week INTEGER, -- 0-6 for weekly reports (0 = Sunday)
  day_of_month INTEGER, -- 1-31 for monthly reports
  time_of_day TIME NOT NULL DEFAULT '09:00:00', -- Time to send report
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Filters and settings
  ad_account_ids UUID[] DEFAULT '{}', -- Empty array means all accounts
  platforms TEXT[] DEFAULT '{}', -- Empty array means all platforms
  metrics TEXT[] NOT NULL DEFAULT '{"impressions", "clicks", "spend", "conversions"}',
  date_range VARCHAR(50) DEFAULT 'last_7_days', -- 'yesterday', 'last_7_days', 'last_30_days', 'last_month'

  -- Email configuration
  recipients TEXT[] NOT NULL, -- Array of email addresses
  email_format VARCHAR(20) DEFAULT 'html', -- 'html', 'pdf', 'both'
  include_charts BOOLEAN DEFAULT true,
  include_recommendations BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_scheduled_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report execution history
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id UUID NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,

  -- Execution details
  status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'sent', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Report content
  report_data JSONB,
  file_path TEXT, -- Path to generated PDF/file if applicable

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_workspace ON scheduled_reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_scheduled ON scheduled_reports(next_scheduled_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_report_executions_scheduled_report ON report_executions(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_executions_created ON report_executions(created_at DESC);

-- Function to update next_scheduled_at
CREATE OR REPLACE FUNCTION update_next_scheduled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    IF NEW.frequency = 'daily' THEN
      NEW.next_scheduled_at := (CURRENT_DATE + NEW.time_of_day::TIME)::TIMESTAMP WITH TIME ZONE;
      IF NEW.next_scheduled_at <= NOW() THEN
        NEW.next_scheduled_at := NEW.next_scheduled_at + INTERVAL '1 day';
      END IF;
    ELSIF NEW.frequency = 'weekly' THEN
      -- Calculate next occurrence of the specified day of week
      NEW.next_scheduled_at := (
        CURRENT_DATE +
        ((NEW.day_of_week - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + 7) % 7)::INTEGER * INTERVAL '1 day' +
        NEW.time_of_day::TIME
      )::TIMESTAMP WITH TIME ZONE;
      IF NEW.next_scheduled_at <= NOW() THEN
        NEW.next_scheduled_at := NEW.next_scheduled_at + INTERVAL '7 days';
      END IF;
    ELSIF NEW.frequency = 'monthly' THEN
      -- Calculate next occurrence of the specified day of month
      NEW.next_scheduled_at := (
        DATE_TRUNC('month', CURRENT_DATE) +
        (NEW.day_of_month - 1)::INTEGER * INTERVAL '1 day' +
        NEW.time_of_day::TIME
      )::TIMESTAMP WITH TIME ZONE;
      IF NEW.next_scheduled_at <= NOW() THEN
        NEW.next_scheduled_at := NEW.next_scheduled_at + INTERVAL '1 month';
      END IF;
    END IF;
  ELSE
    NEW.next_scheduled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update next_scheduled_at
CREATE TRIGGER set_next_scheduled_at
  BEFORE INSERT OR UPDATE OF frequency, day_of_week, day_of_month, time_of_day, is_active
  ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_next_scheduled_at();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_reports_timestamp
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_reports_updated_at();
