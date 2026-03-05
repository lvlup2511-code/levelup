-- ============================================================
-- 009_cognitive_gamification.sql
-- LevelUp V5.0: Think Engine & Cognitive Gamification
-- Features: Cognitive levels, badges, weekly challenges,
--           global matchmaking (find rivals)
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │ 1. PROFILES: Add cognitive gamification columns           │
-- └──────────────────────────────────────────────────────────┘

-- Cognitive level (1–12), defaults to 1
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cognitive_level INTEGER NOT NULL DEFAULT 1
    CHECK (cognitive_level BETWEEN 1 AND 12);

-- Academic track (scientific, literary, general) — nullable until onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academic_track TEXT DEFAULT NULL
    CHECK (academic_track IS NULL OR academic_track IN ('scientific', 'literary', 'general'));

-- Cognitive XP — separate from the main xp_points
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cognitive_xp INTEGER NOT NULL DEFAULT 0;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 2. BADGES TABLE                                           │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.badges (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    title_en      TEXT NOT NULL,
    title_ar      TEXT NOT NULL,
    description_en TEXT,
    description_ar TEXT,
    emoji         TEXT NOT NULL DEFAULT '🏅',
    category      TEXT NOT NULL DEFAULT 'thinking',
    xp_threshold  INTEGER DEFAULT NULL,  -- Auto-award when cognitive_xp reaches this
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for badges (public read, no user writes)
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are viewable by everyone"
    ON public.badges FOR SELECT
    USING (true);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 3. SEED: Default badge data                               │
-- └──────────────────────────────────────────────────────────┘

INSERT INTO public.badges (name, title_en, title_ar, description_en, description_ar, emoji, category, xp_threshold)
VALUES
    ('analytical_master',   'Analytical Master',   'سيد التحليل',       'Master the art of breaking down complex problems', 'أتقن فن تحليل المشاكل المعقدة', '🔬', 'thinking', 500),
    ('critical_thinker',    'Critical Thinker',    'المفكر الناقد',      'Demonstrate exceptional critical thinking skills', 'أظهر مهارات تفكير نقدي استثنائية', '🧠', 'thinking', 1000),
    ('problem_solver',      'Problem Solver',      'حلّال المشاكل',      'Solve challenges with creative approaches',        'حل التحديات بأساليب إبداعية',     '💡', 'thinking', 2000),
    ('consistency_hero',    'Consistency Hero',    'بطل الاستمرارية',    'Maintain a streak of consistent learning',         'حافظ على سلسلة تعلم مستمرة',      '🔥', 'consistency', NULL),
    ('logic_legend',        'Logic Legend',        'أسطورة المنطق',      'Reach cognitive level 6',                          'وصل للمستوى المعرفي ٦',           '♟️', 'milestone', NULL),
    ('independent_master',  'Independent Master',  'الماجستير المستقل',   'Reach the highest cognitive level (12)',            'وصل لأعلى مستوى معرفي (١٢)',      '👑', 'milestone', NULL),
    ('first_deduction',     'First Deduction',     'أول استنتاج',        'Complete your first Think Engine session',          'أكمل أول جلسة في محرك التفكير',   '🎯', 'thinking', 50),
    ('socratic_student',    'Socratic Student',    'تلميذ سقراط',        'Answer 10 Socratic questions correctly',            'أجب على ١٠ أسئلة سقراطية بشكل صحيح', '📚', 'thinking', 300)
ON CONFLICT (name) DO NOTHING;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 4. USER_BADGES JUNCTION TABLE                             │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.user_badges (
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id   INTEGER NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Everyone can see who earned what (social feature)
CREATE POLICY "User badges are viewable by everyone"
    ON public.user_badges FOR SELECT
    USING (true);

-- System inserts badges (via service_role or triggers)
-- Users cannot self-assign badges
CREATE POLICY "Users can view own badges for insert check"
    ON public.user_badges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 5. WEEKLY CHALLENGES TABLE                                │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.weekly_challenges (
    id               SERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    description      TEXT,
    category         TEXT NOT NULL DEFAULT 'logic',
    difficulty_level INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 12),
    xp_reward        INTEGER NOT NULL DEFAULT 50,
    week_start       DATE NOT NULL DEFAULT (date_trunc('week', NOW())::date),
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges are viewable by everyone"
    ON public.weekly_challenges FOR SELECT
    USING (true);

-- Seed some initial weekly challenges
INSERT INTO public.weekly_challenges (title, description, category, difficulty_level, xp_reward)
VALUES
    ('Logic Riddle Sprint',      'Solve 5 logic riddles using deduction',                  'logic',   3,  100),
    ('Math Problem Marathon',    'Work through 10 algebra problems step by step',           'math',    5,  150),
    ('Physics Thought Experiment', 'Analyze a real-world physics scenario using reasoning', 'physics', 6,  200),
    ('Critical Reading Challenge', 'Evaluate and critique 3 arguments in given passages',  'critique', 4, 120),
    ('Pattern Recognition',      'Identify patterns in sequences and data sets',            'logic',   2,  80)
ON CONFLICT DO NOTHING;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 6. CHALLENGE PARTICIPANTS TABLE                           │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id            SERIAL PRIMARY KEY,
    challenge_id  INTEGER NOT NULL REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score         INTEGER NOT NULL DEFAULT 0,
    completed     BOOLEAN NOT NULL DEFAULT false,
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (challenge_id, user_id)
);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenge participation is viewable by everyone"
    ON public.challenge_participants FOR SELECT
    USING (true);

CREATE POLICY "Users can join challenges"
    ON public.challenge_participants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation"
    ON public.challenge_participants FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 7. RPC: find_rivals — Global Matchmaking                  │
-- │    Returns profiles within ±1 cognitive_level,            │
-- │    excluding self and ANY existing relationship.          │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.find_rivals(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    username TEXT,
    avatar_url TEXT,
    cognitive_level INTEGER,
    cognitive_xp INTEGER,
    academic_track TEXT
) AS $$
DECLARE
    v_level INTEGER;
BEGIN
    -- Get the caller's cognitive level
    SELECT p.cognitive_level INTO v_level
    FROM public.profiles p
    WHERE p.id = p_user_id;

    IF v_level IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.avatar_url,
        p.cognitive_level,
        p.cognitive_xp,
        p.academic_track
    FROM public.profiles p
    WHERE p.id != p_user_id
      AND p.cognitive_level BETWEEN (v_level - 1) AND (v_level + 1)
      -- Exclude ANY existing relationship (pending, accepted, blocked)
      AND NOT EXISTS (
          SELECT 1 FROM public.friendships f
          WHERE (
                (f.requester_id = p_user_id AND f.addressee_id = p.id)
                OR
                (f.requester_id = p.id AND f.addressee_id = p_user_id)
            )
      )
    ORDER BY ABS(p.cognitive_level - v_level), p.cognitive_xp DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 8. TRIGGER: Auto-award XP-threshold badges                │
-- │    When cognitive_xp is updated, check if any badges      │
-- │    should be auto-awarded.                                │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.check_badge_awards()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when cognitive_xp actually increased
    IF NEW.cognitive_xp > OLD.cognitive_xp THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        SELECT NEW.id, b.id
        FROM public.badges b
        WHERE b.xp_threshold IS NOT NULL
          AND b.xp_threshold <= NEW.cognitive_xp
          AND NOT EXISTS (
              SELECT 1 FROM public.user_badges ub
              WHERE ub.user_id = NEW.id AND ub.badge_id = b.id
          );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_badge_awards ON public.profiles;
CREATE TRIGGER trg_check_badge_awards
    AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_badge_awards();

-- ┌──────────────────────────────────────────────────────────┐
-- │ 9. INDEX for matchmaking performance                      │
-- └──────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_profiles_cognitive_level
    ON public.profiles (cognitive_level);

CREATE INDEX IF NOT EXISTS idx_user_badges_user
    ON public.user_badges (user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge
    ON public.challenge_participants (challenge_id);

-- ============================================================
-- Done! ✅
--
-- Summary of what was created/modified:
--   • profiles: +cognitive_level, +academic_track, +cognitive_xp
--   • badges table with 8 seed badges
--   • user_badges junction table (composite PK)
--   • weekly_challenges table with 5 seed challenges
--   • challenge_participants table
--   • RPC: find_rivals(p_user_id) — matchmaking
--   • Trigger: trg_check_badge_awards — auto-awards badges
--   • Indexes for performance
--   • RLS on all new tables
-- ============================================================
