-- ============================================================
-- 006_social_engine.sql
-- LevelUp V3: Pillar 1 — Social Engine (Friends & Competition)
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │ 1. FRIENDSHIP STATUS ENUM                                │
-- └──────────────────────────────────────────────────────────┘

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friendship_status') THEN
        CREATE TYPE public.friendship_status AS ENUM (
            'pending',    -- Request sent
            'accepted',   -- Friends
            'blocked'     -- One user blocked the other
        );
    END IF;
END $$;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 2. FRIENDSHIPS TABLE                                     │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.friendships (
    id            BIGSERIAL PRIMARY KEY,
    requester_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    addressee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status        public.friendship_status NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate relationships
    CONSTRAINT unique_friendship_pair 
        UNIQUE (requester_id, addressee_id),
    -- Cannot befriend yourself
    CONSTRAINT no_self_friendship 
        CHECK (requester_id != addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships (addressee_id, status);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 3. WEEKLY XP TRACKING (For Weekly Leaderboards)          │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.weekly_xp (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  DATE NOT NULL, -- Always Monday of the week
    xp_earned   INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_xp_lookup ON public.weekly_xp (week_start, xp_earned DESC);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 4. ROW LEVEL SECURITY — FRIENDSHIPS                      │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can see friendships they are part of
CREATE POLICY "Users can view own friendships"
    ON public.friendships FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can send requests
CREATE POLICY "Users can send friend requests"
    ON public.friendships FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

-- Users can update status (accept, block, etc.)
CREATE POLICY "Users can update own friendships"
    ON public.friendships FOR UPDATE
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
    WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can delete friendships (unfriend)
CREATE POLICY "Users can delete own friendships"
    ON public.friendships FOR DELETE
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 5. ROW LEVEL SECURITY — WEEKLY XP                        │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE public.weekly_xp ENABLE ROW LEVEL SECURITY;

-- Standard users can view all weekly XP (for leaderboard)
CREATE POLICY "Weekly XP is viewable by everyone"
    ON public.weekly_xp FOR SELECT
    USING (true);

-- System or RPC updates this

-- ┌──────────────────────────────────────────────────────────┐
-- │ 6. RPC: get_friends_leaderboard                          │
-- │    Fetches current user + accepted friends XP.           │
-- │    Supports 'weekly' or 'all_time' via p_type parameter. │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.get_friends_leaderboard(
    p_type TEXT DEFAULT 'all_time' -- 'all_time' or 'weekly'
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    avatar_url TEXT,
    xp_points INTEGER,
    rank BIGINT
) AS $$
DECLARE
    v_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
BEGIN
    IF p_type = 'weekly' THEN
        RETURN QUERY
        WITH friend_ids AS (
            SELECT requester_id AS fid FROM public.friendships WHERE addressee_id = auth.uid() AND status = 'accepted'
            UNION
            SELECT addressee_id AS fid FROM public.friendships WHERE requester_id = auth.uid() AND status = 'accepted'
            UNION
            SELECT auth.uid() AS fid -- Include current user
        )
        SELECT 
            p.id,
            p.username,
            p.avatar_url,
            COALESCE(w.xp_earned, 0) as xp_points,
            RANK() OVER (ORDER BY COALESCE(w.xp_earned, 0) DESC) as rank
        FROM public.profiles p
        LEFT JOIN public.weekly_xp w ON p.id = w.user_id AND w.week_start = v_week_start
        WHERE p.id IN (SELECT fid FROM friend_ids)
        ORDER BY xp_points DESC;
    ELSE
        RETURN QUERY
        WITH friend_ids AS (
            SELECT requester_id AS fid FROM public.friendships WHERE addressee_id = auth.uid() AND status = 'accepted'
            UNION
            SELECT addressee_id AS fid FROM public.friendships WHERE requester_id = auth.uid() AND status = 'accepted'
            UNION
            SELECT auth.uid() AS fid -- Include current user
        )
        SELECT 
            p.id,
            p.username,
            p.avatar_url,
            p.xp_points,
            RANK() OVER (ORDER BY p.xp_points DESC) as rank
        FROM public.profiles p
        WHERE p.id IN (SELECT fid FROM friend_ids)
        ORDER BY p.xp_points DESC;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 7. Triggers for updated_at                               │
-- └──────────────────────────────────────────────────────────┘

DROP TRIGGER IF EXISTS set_friendships_updated_at ON public.friendships;
CREATE TRIGGER set_friendships_updated_at
    BEFORE UPDATE ON public.friendships
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_weekly_xp_updated_at ON public.weekly_xp;
CREATE TRIGGER set_weekly_xp_updated_at
    BEFORE UPDATE ON public.weekly_xp
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
