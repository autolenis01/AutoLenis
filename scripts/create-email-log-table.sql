-- Create email_log table for comprehensive email tracking and audit trail
-- This table logs all email sends via Resend for debugging, compliance, and retry logic

CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email identifiers
  resend_id VARCHAR(255),  -- Resend's email ID for tracking
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Email details
  email_type VARCHAR(100) NOT NULL,  -- e.g. 'verification', 'password_reset', 'deal_approved'
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject TEXT NOT NULL,
  
  -- Delivery tracking
  status VARCHAR(50) DEFAULT 'sent',  -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
  error_message TEXT,
  
  -- Metadata
  metadata JSONB,  -- Additional context (e.g., deal_id, token, etc.)
  
  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_recipient_email ON email_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_log_email_type ON email_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_resend_id ON email_log(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at DESC);

-- Enable RLS
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin full access
CREATE POLICY email_log_admin_all ON email_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can view their own email logs
CREATE POLICY email_log_user_select ON email_log
  FOR SELECT
  USING (user_id = auth.uid());

-- System can insert (for API routes)
CREATE POLICY email_log_system_insert ON email_log
  FOR INSERT
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_email_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_log_updated_at_trigger
  BEFORE UPDATE ON email_log
  FOR EACH ROW
  EXECUTE FUNCTION update_email_log_updated_at();
