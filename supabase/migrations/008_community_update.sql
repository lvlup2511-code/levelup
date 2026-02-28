-- ============================================================
-- 008_community_update.sql
-- LevelUp V4.0: Community & Personalization Update
-- Features: Direct Messaging, Notifications Engine
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │ 1. HELPER: are_friends(user_a, user_b)                   │
-- │    Returns TRUE if the two users have an 'accepted'      │
-- │    friendship. Used by RLS policies & triggers.          │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
          AND (
              (requester_id = user_a AND addressee_id = user_b)
              OR
              (requester_id = user_b AND addressee_id = user_a)
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 2. NOTIFICATION TYPE ENUM                                │
-- └──────────────────────────────────────────────────────────┘

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE public.notification_type AS ENUM (
            'friend_request',      -- Someone sent you a friend request
            'friend_accepted',     -- Your friend request was accepted
            'direct_message',      -- You received a new DM
            'mission_completed',   -- You completed a daily mission
            'level_up',            -- You leveled up
            'system'               -- System announcements
        );
    END IF;
END $$;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 3. DIRECT MESSAGES TABLE                                  │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.direct_messages (
    id            BIGSERIAL PRIMARY KEY,
    sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content       TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
    is_read       BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Cannot message yourself
    CONSTRAINT no_self_message
        CHECK (sender_id != receiver_id)
);

-- Indexes for fast conversation lookups
CREATE INDEX IF NOT EXISTS idx_dm_sender
    ON public.direct_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_receiver
    ON public.direct_messages (receiver_id, created_at DESC);
-- Composite index for fetching a conversation between two users
CREATE INDEX IF NOT EXISTS idx_dm_conversation
    ON public.direct_messages (
        LEAST(sender_id, receiver_id),
        GREATEST(sender_id, receiver_id),
        created_at DESC
    );

-- ┌──────────────────────────────────────────────────────────┐
-- │ 4. NOTIFICATIONS TABLE                                    │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.notifications (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type          public.notification_type NOT NULL,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL,
    metadata      JSONB DEFAULT '{}'::jsonb,   -- Flexible payload (sender_id, message_id, etc.)
    is_read       BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON public.notifications (user_id, is_read, created_at DESC);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 5. ROW LEVEL SECURITY — DIRECT MESSAGES                   │
-- │    STRICT: Only sender & receiver can interact,           │
-- │    and only if they are accepted friends.                 │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: You can only read messages you sent or received
CREATE POLICY "Users can view own messages"
    ON public.direct_messages FOR SELECT
    USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
    );

-- INSERT: You can only send messages AS yourself, and ONLY to accepted friends
CREATE POLICY "Users can send messages to friends"
    ON public.direct_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND public.are_friends(sender_id, receiver_id)
    );

-- UPDATE: Only the receiver can mark messages as read
CREATE POLICY "Receiver can mark messages as read"
    ON public.direct_messages FOR UPDATE
    USING (auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = receiver_id);

-- DELETE: No one can delete messages (preserves chat history)
-- No DELETE policy = denied by default with RLS enabled ✅

-- ┌──────────────────────────────────────────────────────────┐
-- │ 6. ROW LEVEL SECURITY — NOTIFICATIONS                     │
-- └──────────────────────────────────────────────────────────┘

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update (mark as read) only their own notifications
CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete (dismiss) only their own notifications
CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

-- INSERT is reserved for triggers/service_role — no user INSERT policy needed.
-- All notifications are generated server-side via triggers below.

-- ┌──────────────────────────────────────────────────────────┐
-- │ 7. TRIGGER: Auto-notify on new friend request             │
-- │    Fires when a row is inserted into friendships with     │
-- │    status = 'pending'.                                    │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.notify_on_friend_request()
RETURNS TRIGGER AS $$
DECLARE
    v_requester_name TEXT;
BEGIN
    -- Only fire for new pending requests
    IF NEW.status = 'pending' THEN
        -- Get the requester's username
        SELECT COALESCE(username, 'مستخدم') INTO v_requester_name
        FROM public.profiles
        WHERE id = NEW.requester_id;

        INSERT INTO public.notifications (user_id, type, title, content, metadata)
        VALUES (
            NEW.addressee_id,
            'friend_request',
            'طلب صداقة جديد',
            v_requester_name || ' أرسل لك طلب صداقة',
            jsonb_build_object(
                'requester_id', NEW.requester_id,
                'friendship_id', NEW.id
            )
        );
    END IF;

    -- Also notify when a friendship is accepted (via UPDATE)
    IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
        SELECT COALESCE(username, 'مستخدم') INTO v_requester_name
        FROM public.profiles
        WHERE id = NEW.addressee_id;

        INSERT INTO public.notifications (user_id, type, title, content, metadata)
        VALUES (
            NEW.requester_id,
            'friend_accepted',
            'تم قبول طلب الصداقة',
            v_requester_name || ' قبل طلب صداقتك',
            jsonb_build_object(
                'friend_id', NEW.addressee_id,
                'friendship_id', NEW.id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on INSERT (new friend request)
DROP TRIGGER IF EXISTS trg_notify_friend_request ON public.friendships;
CREATE TRIGGER trg_notify_friend_request
    AFTER INSERT ON public.friendships
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_friend_request();

-- Trigger on UPDATE (friend request accepted)
DROP TRIGGER IF EXISTS trg_notify_friend_accepted ON public.friendships;
CREATE TRIGGER trg_notify_friend_accepted
    AFTER UPDATE ON public.friendships
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_friend_request();

-- ┌──────────────────────────────────────────────────────────┐
-- │ 8. TRIGGER: Auto-notify on new direct message             │
-- │    Fires when a new message is inserted.                  │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS TRIGGER AS $$
DECLARE
    v_sender_name TEXT;
BEGIN
    -- Get the sender's username
    SELECT COALESCE(username, 'مستخدم') INTO v_sender_name
    FROM public.profiles
    WHERE id = NEW.sender_id;

    INSERT INTO public.notifications (user_id, type, title, content, metadata)
    VALUES (
        NEW.receiver_id,
        'direct_message',
        'رسالة جديدة',
        v_sender_name || ': ' || LEFT(NEW.content, 100),
        jsonb_build_object(
            'sender_id', NEW.sender_id,
            'message_id', NEW.id
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_direct_message
    AFTER INSERT ON public.direct_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_direct_message();

-- ┌──────────────────────────────────────────────────────────┐
-- │ 9. TRIGGER: Auto-notify on daily mission completion       │
-- │    Fires when user_missions.is_completed goes to TRUE.    │
-- └──────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.notify_on_mission_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_mission_title TEXT;
    v_mission_emoji TEXT;
BEGIN
    -- Only fire when is_completed changes from false to true
    IF OLD.is_completed = false AND NEW.is_completed = true THEN
        SELECT title_ar, emoji INTO v_mission_title, v_mission_emoji
        FROM public.daily_missions
        WHERE id = NEW.mission_id;

        INSERT INTO public.notifications (user_id, type, title, content, metadata)
        VALUES (
            NEW.user_id,
            'mission_completed',
            'مهمة مكتملة! ' || COALESCE(v_mission_emoji, '⭐'),
            'أحسنت! أكملت مهمة: ' || COALESCE(v_mission_title, 'مهمة يومية'),
            jsonb_build_object(
                'mission_id', NEW.mission_id,
                'user_mission_id', NEW.id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_mission_complete ON public.user_missions;
CREATE TRIGGER trg_notify_mission_complete
    AFTER UPDATE ON public.user_missions
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_mission_complete();

-- ┌──────────────────────────────────────────────────────────┐
-- │ 10. RPCs: Convenience functions for the frontend          │
-- └──────────────────────────────────────────────────────────┘

-- 10a. Get conversation messages between current user and a friend
CREATE OR REPLACE FUNCTION public.get_conversation(p_friend_id UUID)
RETURNS TABLE (
    id BIGINT,
    sender_id UUID,
    receiver_id UUID,
    content TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Verify friendship first
    IF NOT public.are_friends(auth.uid(), p_friend_id) THEN
        RAISE EXCEPTION 'Not friends with this user';
    END IF;

    RETURN QUERY
    SELECT dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.is_read, dm.created_at
    FROM public.direct_messages dm
    WHERE (dm.sender_id = auth.uid() AND dm.receiver_id = p_friend_id)
       OR (dm.sender_id = p_friend_id AND dm.receiver_id = auth.uid())
    ORDER BY dm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10b. Mark all messages from a specific sender as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_sender_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.direct_messages
    SET is_read = true
    WHERE sender_id = p_sender_id
      AND receiver_id = auth.uid()
      AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10c. Get unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.notifications
    WHERE user_id = auth.uid()
      AND is_read = false;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 10d. Mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = auth.uid()
      AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10e. Get chat list (latest message per friend conversation)
CREATE OR REPLACE FUNCTION public.get_chat_list()
RETURNS TABLE (
    friend_id UUID,
    friend_username TEXT,
    friend_avatar TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH conversations AS (
        SELECT
            CASE
                WHEN dm.sender_id = auth.uid() THEN dm.receiver_id
                ELSE dm.sender_id
            END AS other_user_id,
            dm.content,
            dm.created_at,
            dm.is_read,
            dm.sender_id
        FROM public.direct_messages dm
        WHERE dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid()
    ),
    latest_per_friend AS (
        SELECT DISTINCT ON (c.other_user_id)
            c.other_user_id,
            c.content AS last_msg,
            c.created_at AS last_msg_at
        FROM conversations c
        ORDER BY c.other_user_id, c.created_at DESC
    ),
    unread_counts AS (
        SELECT
            c.other_user_id,
            COUNT(*) FILTER (WHERE c.is_read = false AND c.sender_id != auth.uid()) AS unread
        FROM conversations c
        GROUP BY c.other_user_id
    )
    SELECT
        lpf.other_user_id AS friend_id,
        p.username AS friend_username,
        p.avatar_url AS friend_avatar,
        lpf.last_msg AS last_message,
        lpf.last_msg_at AS last_message_at,
        COALESCE(uc.unread, 0) AS unread_count
    FROM latest_per_friend lpf
    JOIN public.profiles p ON p.id = lpf.other_user_id
    LEFT JOIN unread_counts uc ON uc.other_user_id = lpf.other_user_id
    ORDER BY lpf.last_msg_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ┌──────────────────────────────────────────────────────────┐
-- │ 11. ENABLE REALTIME for direct_messages                   │
-- │     (Required for Supabase Realtime WebSocket subscriptions) │
-- └──────────────────────────────────────────────────────────┘

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- Done! ✅
--
-- Summary of what was created:
--   • are_friends() helper function
--   • notification_type ENUM (6 types)
--   • direct_messages table (with content length validation)
--   • notifications table (with JSONB metadata)
--   • Strict RLS: DMs locked to sender/receiver + friend check
--   • Strict RLS: Notifications private per user
--   • Trigger: notify_on_friend_request (INSERT + UPDATE)
--   • Trigger: notify_on_direct_message (INSERT)
--   • Trigger: notify_on_mission_complete (UPDATE)
--   • RPC: get_conversation(friend_id)
--   • RPC: mark_messages_read(sender_id)
--   • RPC: get_unread_notification_count()
--   • RPC: mark_all_notifications_read()
--   • RPC: get_chat_list() — inbox with last message + unread
--   • Realtime enabled for both tables
-- ============================================================
