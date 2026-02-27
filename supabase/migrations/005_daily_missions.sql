-- ============================================================
-- 005_daily_missions.sql
-- LevelUp V3: Retention Engine — Daily Missions & Rewards
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │ 1. ADD COINS COLUMN TO PROFILES (virtual currency)       │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 2. MISSION TYPE ENUM                                     │
-- └──────────────────────────────────────────────────────────┘

CREATE TYPE public.mission_type AS ENUM (
  'ask_questions',       -- "Ask N questions"
  'use_voice',           -- "Ask N questions using voice input"
  'upload_image',        -- "Upload N images for analysis"
  'earn_xp',             -- "Earn N XP today"
  'login_streak',        -- "Maintain a login streak of N days"
  'complete_quests'      -- "Complete N quests"
);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 3. DAILY MISSIONS — Template/Dictionary table            │
-- │    This is the "catalog" of all possible missions.       │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.daily_missions (
  id              SERIAL PRIMARY KEY,
  mission_type    public.mission_type NOT NULL,
  title_ar        TEXT NOT NULL,
  title_en        TEXT NOT NULL,
  description_ar  TEXT,
  description_en  TEXT,
  target_value    INTEGER NOT NULL,       -- e.g., 3 = "do this 3 times"
  xp_reward       INTEGER NOT NULL DEFAULT 0,
  coin_reward     INTEGER NOT NULL DEFAULT 0,
  emoji           TEXT NOT NULL DEFAULT '⭐',
  difficulty      SMALLINT NOT NULL DEFAULT 1,  -- 1=easy, 2=medium, 3=hard
  is_active       BOOLEAN NOT NULL DEFAULT true
);

-- Seed 10 mission templates (Arabic + English)
INSERT INTO public.daily_missions
  (mission_type, title_ar, title_en, description_ar, description_en, target_value, xp_reward, coin_reward, emoji, difficulty)
VALUES
  ('ask_questions',   'اسأل ٣ أسئلة',              'Ask 3 Questions',
   'اسأل المدرس الذكي ٣ أسئلة اليوم',     'Ask the AI tutor 3 questions today',
   3,   30,  5,  '💬', 1),

  ('ask_questions',   'اسأل ٧ أسئلة',              'Ask 7 Questions',
   'اسأل المدرس الذكي ٧ أسئلة اليوم',     'Ask the AI tutor 7 questions today',
   7,   70,  10, '💬', 2),

  ('use_voice',       'استخدم الصوت ٣ مرات',         'Use Voice 3 Times',
   'اسأل باستخدام الميكروفون ٣ مرات',     'Ask using voice input 3 times',
   3,   50,  8,  '🎤', 2),

  ('upload_image',    'ارفع صورة سؤال',             'Upload a Question Image',
   'صوّر سؤال من الكتاب وارفعه',          'Take a photo of a textbook question and upload it',
   1,   25,  5,  '📷', 1),

  ('upload_image',    'ارفع ٣ صور أسئلة',            'Upload 3 Question Images',
   'صوّر ٣ أسئلة من الكتاب وارفعهم',       'Upload 3 textbook question photos',
   3,   75,  12, '📷', 2),

  ('earn_xp',         'اكسب ١٠٠ نقطة خبرة',         'Earn 100 XP',
   'اجمع ١٠٠ نقطة خبرة النهاردة',         'Earn 100 XP points today',
   100, 50,  10, '⚡', 2),

  ('earn_xp',         'اكسب ٢٥٠ نقطة خبرة',         'Earn 250 XP',
   'اجمع ٢٥٠ نقطة خبرة النهاردة',         'Earn 250 XP points today',
   250, 100, 20, '⚡', 3),

  ('login_streak',    'سجّل دخول ٣ أيام متتالية',     'Login Streak: 3 Days',
   'ادخل التطبيق ٣ أيام ورا بعض',         'Log in for 3 consecutive days',
   3,   60,  15, '🔥', 2),

  ('login_streak',    'سجّل دخول ٧ أيام متتالية',     'Login Streak: 7 Days',
   'ادخل التطبيق ٧ أيام ورا بعض',         'Log in for 7 consecutive days',
   7,   150, 30, '🔥', 3),

  ('complete_quests', 'أكمل ٢ تحديات',              'Complete 2 Quests',
   'خلّص ٢ تحديات من خريطة المستويات',     'Complete 2 quests from the level map',
   2,   40,  8,  '🏆', 1);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 4. USER MISSIONS — Per-user, per-day mission instances   │
-- │    Tracks which 3 missions are assigned to a user today  │
-- │    and their individual progress.                        │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.user_missions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id      INTEGER NOT NULL REFERENCES public.daily_missions(id),
  assigned_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  current_value   INTEGER NOT NULL DEFAULT 0,    -- progress counter (e.g., 1 out of 3)
  is_completed    BOOLEAN NOT NULL DEFAULT false,
  is_claimed      BOOLEAN NOT NULL DEFAULT false, -- has the XP/coin reward been collected?
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent assigning the same mission twice on the same day
  UNIQUE (user_id, mission_id, assigned_date)
);

CREATE INDEX idx_user_missions_lookup
  ON public.user_missions (user_id, assigned_date);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 5. ROW LEVEL SECURITY — daily_missions (public catalog)  │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

-- Everyone can read the mission catalog (it's a dictionary)
CREATE POLICY "Mission catalog is viewable by everyone"
  ON public.daily_missions FOR SELECT
  USING (true);

-- Only admins/service_role should INSERT/UPDATE/DELETE templates.
-- No policy needed for authenticated users to modify.

-- ┌──────────────────────────────────────────────────────────┐
-- │ 6. ROW LEVEL SECURITY — user_missions (private per user) │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own missions
CREATE POLICY "Users can view own missions"
  ON public.user_missions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own missions (for assignment)
CREATE POLICY "Users can insert own missions"
  ON public.user_missions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own missions (progress, claim)
CREATE POLICY "Users can update own missions"
  ON public.user_missions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 7. RPC: assign_daily_missions(p_user_id)                 │
-- │    Assigns 3 random missions for today if not already    │
-- │    assigned. Returns today's missions either way.        │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.assign_daily_missions(p_user_id UUID)
RETURNS SETOF public.user_missions AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count how many missions are already assigned today
  SELECT COUNT(*) INTO v_count
  FROM public.user_missions
  WHERE user_id = p_user_id
    AND assigned_date = CURRENT_DATE;

  -- If fewer than 3, assign new random ones
  IF v_count < 3 THEN
    INSERT INTO public.user_missions (user_id, mission_id, assigned_date)
    SELECT p_user_id, id, CURRENT_DATE
    FROM public.daily_missions
    WHERE is_active = true
      AND id NOT IN (
        SELECT mission_id FROM public.user_missions
        WHERE user_id = p_user_id AND assigned_date = CURRENT_DATE
      )
    ORDER BY RANDOM()
    LIMIT (3 - v_count)
    ON CONFLICT (user_id, mission_id, assigned_date) DO NOTHING;
  END IF;

  -- Return all of today's missions
  RETURN QUERY
    SELECT * FROM public.user_missions
    WHERE user_id = p_user_id
      AND assigned_date = CURRENT_DATE
    ORDER BY id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 8. RPC: claim_mission_reward(p_mission_id)               │
-- │    Claims the XP + Coin reward for a completed mission.  │
-- │    Validates: ownership, completion, and not-yet-claimed. │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.claim_mission_reward(p_mission_id BIGINT)
RETURNS jsonb AS $$
DECLARE
  v_mission  public.user_missions;
  v_template public.daily_missions;
BEGIN
  -- 1. Fetch the mission (must belong to the calling user)
  SELECT * INTO v_mission
  FROM public.user_missions
  WHERE id = p_mission_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not found');
  END IF;

  -- 2. Must be completed
  IF NOT v_mission.is_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission not completed yet');
  END IF;

  -- 3. Must not be already claimed
  IF v_mission.is_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
  END IF;

  -- 4. Get the template for reward amounts
  SELECT * INTO v_template
  FROM public.daily_missions
  WHERE id = v_mission.mission_id;

  -- 5. Mark as claimed
  UPDATE public.user_missions
  SET is_claimed = true
  WHERE id = p_mission_id;

  -- 6. Award XP and Coins to the profile atomically
  UPDATE public.profiles
  SET
    xp_points = xp_points + v_template.xp_reward,
    coins     = coins + v_template.coin_reward,
    updated_at = NOW()
  WHERE id = auth.uid();

  -- 7. Return the reward details
  RETURN jsonb_build_object(
    'success',       true,
    'xp_awarded',    v_template.xp_reward,
    'coins_awarded', v_template.coin_reward,
    'mission_title', v_template.title_ar
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 9. Apply updated_at trigger to user_missions             │
-- └──────────────────────────────────────────────────────────┘

-- Reuse the set_updated_at() function from 001_profiles.sql
-- (already exists in the database)

-- Done! ✅
-- 
-- Summary of what was created:
--   • profiles.coins column (INTEGER, default 0)
--   • mission_type ENUM (6 types)
--   • daily_missions table (10 seeded templates)
--   • user_missions table (per-user, per-day tracking)
--   • RLS policies for both tables
--   • assign_daily_missions() RPC
--   • claim_mission_reward() RPC
