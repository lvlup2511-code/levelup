-- ============================================================
-- 010_notebook_lm.sql
-- Smart Study Room: Personal document-based learning
-- ============================================================

-- ┌──────────────────────────────────────────────────────────┐
-- │ 1. STUDY_MATERIALS TABLE                                  │
-- └──────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.study_materials (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own study materials"
    ON public.study_materials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own study materials"
    ON public.study_materials FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own study materials"
    ON public.study_materials FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study materials"
    ON public.study_materials FOR DELETE
    USING (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 2. INDEXES                                                │
-- └──────────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_study_materials_user ON public.study_materials(user_id);

-- ┌──────────────────────────────────────────────────────────┐
-- │ 3. SEED: Dummy data for testing                           │
-- └──────────────────────────────────────────────────────────┘

-- Note: We don't know the exact user IDs here, but this serves as a template.
-- Usually, users will add their own via the UI.
