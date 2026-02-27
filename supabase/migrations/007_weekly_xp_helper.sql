-- ============================================================
-- 007_weekly_xp_helper.sql
-- Missing helper for social leaderboard tracking.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_weekly_xp(
  p_user_id UUID,
  p_xp_amount INTEGER
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.weekly_xp (user_id, week_start, xp_earned)
  VALUES (
    p_user_id,
    date_trunc('week', CURRENT_DATE)::DATE,  -- Monday of current ISO week
    p_xp_amount
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    xp_earned = weekly_xp.xp_earned + p_xp_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
