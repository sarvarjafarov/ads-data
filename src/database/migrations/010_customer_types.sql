-- Add customer_type column to users table
-- This migration adds support for both B2B and B2C customers

ALTER TABLE users
ADD COLUMN IF NOT EXISTS customer_type VARCHAR(10) DEFAULT 'b2b' CHECK (customer_type IN ('b2b', 'b2c'));

-- Update existing users to be B2B by default
UPDATE users
SET customer_type = 'b2b'
WHERE customer_type IS NULL;

-- Make company_name optional for B2C customers
ALTER TABLE users
ALTER COLUMN company_name DROP NOT NULL;

-- Add index for faster queries by customer type
CREATE INDEX IF NOT EXISTS idx_users_customer_type ON users(customer_type);

-- Comments
COMMENT ON COLUMN users.customer_type IS 'Customer type: b2b (business) or b2c (individual consumer)';
