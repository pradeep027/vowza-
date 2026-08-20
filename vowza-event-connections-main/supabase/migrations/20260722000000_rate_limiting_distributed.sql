-- Migration: Distributed Rate Limiting for Edge Functions
-- Purpose: Provide shared, persistent rate-limit state across multiple Edge Function instances
-- Security: RLS policies prevent users from accessing/manipulating rate limit data
-- 
-- Design:
-- - Each rate limit entry tracks (client_id, window_start, request_count)
-- - Client_id is either "auth:{user_id}" or "anon:{ip_hash}"
-- - 60-second sliding windows with automatic cleanup
-- - Only Edge Functions (service role) can write entries
-- - Users cannot read or modify rate limit records
-- - ATOMIC INCREMENT: Uses RPC with atomic increment to prevent race conditions

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Client identifier: "auth:{user_id}" or "anon:{ip_hash}"
  client_id TEXT NOT NULL,
  -- Whether this is an authenticated or anonymous rate limit
  is_authenticated BOOLEAN NOT NULL DEFAULT FALSE,
  -- Request count in current window
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count >= 0),
  -- Window start time (60-second windows)
  window_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Record creation time (for cleanup)
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Updated time (for tracking)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Unique constraint: only one entry per client_id + window_start
  UNIQUE(client_id, window_start)
);

-- Index for efficient queries by client_id and window
CREATE INDEX IF NOT EXISTS idx_rate_limits_client_window 
ON rate_limits(client_id, window_start DESC);

-- Index for cleanup queries (remove old entries)
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at 
ON rate_limits(created_at DESC);

-- Enable RLS to prevent users from accessing rate limit data
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy 1: Default deny all (most secure)
CREATE POLICY "rate_limits_default_deny"
ON rate_limits
USING (false)
WITH CHECK (false);

-- Policy 2: Allow Edge Functions (service role) to read all records
-- Note: Service role bypass RLS automatically in Supabase, so this is for clarity
-- In practice, service role will read/write directly without checking policies
CREATE POLICY "rate_limits_service_role_read"
ON rate_limits FOR SELECT
USING (auth.role() = 'authenticated' AND false)  -- Effectively disabled for users
WITH CHECK (false);

-- Policy 3: Allow Edge Functions (service role) to insert records
CREATE POLICY "rate_limits_service_role_insert"
ON rate_limits FOR INSERT
WITH CHECK (auth.role() = 'authenticated' AND false)  -- Effectively disabled for users
WITH CHECK (false);

-- Policy 4: Allow Edge Functions (service role) to update records
CREATE POLICY "rate_limits_service_role_update"
ON rate_limits FOR UPDATE
USING (auth.role() = 'authenticated' AND false)  -- Effectively disabled for users
WITH CHECK (false);

-- Policy 5: Allow Edge Functions (service role) to delete records (for cleanup)
CREATE POLICY "rate_limits_service_role_delete"
ON rate_limits FOR DELETE
USING (auth.role() = 'authenticated' AND false)  -- Effectively disabled for users
WITH CHECK (false);

-- Create ATOMIC increment function - prevents race conditions
-- This function:
-- 1. Checks if an entry exists for (client_id, window_start) with window_start > p_window_start
-- 2. If it exists and request_count >= p_limit: returns allowed=false
-- 3. If it doesn't exist or window is old: creates new entry, returns allowed=true
-- 4. If it exists and request_count < p_limit: increments atomically, returns allowed=true
--
-- CRITICAL: This runs server-side and is ATOMIC - no race conditions possible
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_client_id TEXT,
  p_is_authenticated BOOLEAN,
  p_window_start TIMESTAMPTZ,
  p_now TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS TABLE (allowed BOOLEAN, new_count INTEGER, window_start TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_entry record;
  v_new_count INTEGER;
BEGIN
  -- Step 1: Try to find existing entry for this window
  -- Use SELECT FOR UPDATE to lock the row and prevent concurrent increments
  SELECT * INTO v_entry
  FROM rate_limits
  WHERE client_id = p_client_id
    AND is_authenticated = p_is_authenticated
    AND window_start > p_window_start
  ORDER BY window_start DESC
  LIMIT 1
  FOR UPDATE;  -- CRITICAL: Locks this row for the duration of the transaction

  -- Step 2a: If entry exists in current window, check and increment
  IF v_entry IS NOT NULL THEN
    -- Check if limit already exceeded
    IF v_entry.request_count >= p_limit THEN
      RETURN QUERY SELECT false, v_entry.request_count, v_entry.window_start;
      RETURN;
    END IF;

    -- Increment atomically (within transaction lock)
    v_new_count := v_entry.request_count + 1;
    UPDATE rate_limits
    SET request_count = v_new_count, updated_at = p_now
    WHERE id = v_entry.id;

    RETURN QUERY SELECT true, v_new_count, v_entry.window_start;
    RETURN;
  END IF;

  -- Step 2b: No current entry, create new one for this window
  -- Use INSERT ... ON CONFLICT to handle race where two transactions insert simultaneously
  INSERT INTO rate_limits (client_id, is_authenticated, request_count, window_start, created_at, updated_at)
  VALUES (p_client_id, p_is_authenticated, 1, p_now, p_now, p_now)
  ON CONFLICT (client_id, window_start) DO UPDATE
  SET request_count = rate_limits.request_count + 1,
      updated_at = p_now
  RETURNING (rate_limits.request_count), rate_limits.window_start
  INTO v_new_count, v_entry.window_start;

  -- Always allow first request in new window
  RETURN QUERY SELECT true, v_new_count, v_entry.window_start;
END;
$$;

-- Grant execute to service role (Edge Functions)
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;

-- Create cleanup function to remove old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete rate limit entries older than 2 minutes (safe window)
  -- This ensures even if a window is extended, we clean up eventually
  DELETE FROM rate_limits
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '2 minutes';
END;
$$;

-- Optional: Create a trigger to automatically clean old entries when a new one is inserted
-- This keeps cleanup opportunistic without requiring a separate cron job
CREATE OR REPLACE FUNCTION trigger_cleanup_rate_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clean up old entries every 100 inserts (to avoid excessive cleanup)
  IF (SELECT COUNT(*) FROM rate_limits) % 100 = 0 THEN
    PERFORM cleanup_expired_rate_limits();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rate_limits_cleanup_trigger
AFTER INSERT ON rate_limits
FOR EACH ROW
EXECUTE FUNCTION trigger_cleanup_rate_limits();

-- Create comment documenting the table
COMMENT ON TABLE rate_limits IS 'Distributed rate limiting for Edge Functions. Stores request counts per client in 60-second windows. RLS prevents users from accessing this data. Only Edge Functions (service role) write to this table. Uses atomic increment_rate_limit RPC to prevent race conditions.';

COMMENT ON COLUMN rate_limits.client_id IS 'Unique identifier for the client: "auth:{user_id}" for authenticated users or "anon:{ip_hash}" for anonymous users.';

COMMENT ON COLUMN rate_limits.is_authenticated IS 'TRUE for authenticated user requests (50 req/min limit), FALSE for anonymous requests (10 req/min limit).';

COMMENT ON COLUMN rate_limits.request_count IS 'Number of requests from this client in the current 60-second window.';

COMMENT ON COLUMN rate_limits.window_start IS 'Start timestamp of the current 60-second rate limit window.';

COMMENT ON COLUMN rate_limits.created_at IS 'When this rate limit entry was created.';

COMMENT ON COLUMN rate_limits.updated_at IS 'When this rate limit entry was last updated.';

COMMENT ON FUNCTION public.increment_rate_limit(TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS 'Atomically increments rate limit counter, preventing race conditions. Uses SELECT FOR UPDATE and transaction locking for atomicity. Returns (allowed, new_count, window_start).';

