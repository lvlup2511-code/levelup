# LevelUp — Implementation Roadmap

> **Goal:** Complete the remaining features for the Google AI Hackathon submission.
> **Date:** 2026-02-27

---

## 📊 Current State Summary

| Feature | Status | Notes |
|---|---|---|
| Supabase Auth (Email/Password) | ✅ Done | Sign in/up flow in `/app/login/page.tsx` |
| Supabase Profiles table | ✅ Done | `001_profiles.sql` — xp_points, streaks, quests_completed |
| Gemini 2.5 Flash Chat API | ✅ Done | `/app/api/chat/route.ts` with system prompt |
| Vision (Image Upload) | ✅ Done | Camera/file input → base64 → Gemini `inlineData` |
| Text-to-Speech (TTS) | ✅ Done | Browser `SpeechSynthesis` in `/app/quest/page.tsx` |
| Dashboard (server component) | ✅ Done | Reads profile from Supabase, shows XP/level/achievements |
| Leaderboard (server component) | ✅ Done | Top 20 by XP from Supabase |
| Level Map UI | ✅ Done | 12-level winding path, uses `config/gameData.ts` |
| Speech-to-Text (Mic input) | ❌ Pending | Mic button exists but is `disabled` |
| Gamification (award XP after chat) | ❌ Pending | No server-side XP logic; homepage stats are hardcoded |
| UI/UX Polish & Animations | ❌ Pending | Minimal animations; no transitions, toasts, or level-up effects |

---

## 🗺️ Remaining Features — Step-by-Step Roadmap

### Phase 1: Speech-to-Text (Web Speech API)

**Goal:** Enable the disabled microphone button in the quest chat so users can speak instead of type.

#### Step 1.1 — Create a `useSpeechToText` hook
- **File:** `hooks/useSpeechToText.ts` *(NEW)*
- Use the browser's native `webkitSpeechRecognition` / `SpeechRecognition` API.
- Expose: `{ transcript, isListening, startListening, stopListening, isSupported }`.
- Set `lang` to `"ar-SA"` (matching the existing TTS language).
- Handle `onresult`, `onerror`, `onend` events.

#### Step 1.2 — Wire the hook into the Quest page
- **File:** `app/quest/page.tsx` *(MODIFY)*
- Import and use `useSpeechToText`.
- Remove `disabled` from the Mic button.
- While listening: change Mic icon style (pulsing red animation), append real-time transcript to the input field.
- On stop: auto-populate the text input with the final transcript.

#### Step 1.3 — Add a `MicButton` component (optional extraction)
- **File:** `components/MicButton.tsx` *(NEW — optional)*
- Encapsulate the mic toggle logic + visual states (idle, listening, unsupported).

---

### Phase 2: Gamification System (XP Awarding)

**Goal:** Award XP to the authenticated user after each successful AI interaction. Show level-ups.

#### Step 2.1 — Create an `/api/xp` server route
- **File:** `app/api/xp/route.ts` *(NEW)*
- **POST** endpoint: receives `{ userId, xpAmount }`.
- Reads the user's current profile → increments `xp_points` → writes back to Supabase.
- Returns `{ newXp, previousLevel, newLevel, leveledUp }`.
- Validate auth (check that the caller is the same user).

#### Step 2.2 — Define XP constants and helpers
- **File:** `lib/gamification.ts` *(NEW)*
- `XP_PER_INTERACTION = 10` (base XP per chat message).
- `XP_PER_IMAGE_QUEST = 25` (bonus for image-based questions).
- `XP_PER_LEVEL = 500` (already used in dashboard — centralize here).
- `getLevelFromXp(xp)` function (move from `app/dashboard/page.tsx` to here).
- `calculateXpAward(hasImage: boolean): number`.

#### Step 2.3 — Call `/api/xp` after each successful chat reply
- **File:** `app/quest/page.tsx` *(MODIFY)*
- After receiving a successful AI reply, fire a `POST /api/xp` request.
- Pass the authenticated user's ID and calculated XP amount.
- On response: if `leveledUp === true`, show a level-up celebration.

#### Step 2.4 — Make the homepage dynamic
- **File:** `app/page.tsx` *(MODIFY)*
- Replace hardcoded "1,240 XP" / "7 days" / "5 Quests Done" with real data from the user's Supabase profile.
- If user is not signed in, show default/placeholder values.

#### Step 2.5 — Update streak logic (optional enhancement)
- **File:** `app/api/xp/route.ts` *(MODIFY)*
- Track `last_active_date` on the profile. If the user's last activity was yesterday, increment `current_streak`; if today, no change; otherwise, reset to 1.
- Update `highest_streak` if the new streak is higher.

---

### Phase 3: UI/UX Polish & Animations ("Habashtakanat")

**Goal:** Make the app feel alive, premium, and hackathon-ready.

#### Step 3.1 — Add page transition animations
- **File:** `app/layout.tsx` *(MODIFY)*
- Wrap `{children}` with a fade-in/slide-in animation using CSS transitions or `framer-motion`.
- Consider adding `framer-motion` as a dependency.

#### Step 3.2 — XP & Level-Up celebration overlay
- **File:** `components/LevelUpModal.tsx` *(NEW)*
- A full-screen or centered modal/toast that appears when the user levels up.
- Shows: confetti/particle effect, new level number, motivational message.
- Auto-dismiss after ~3 seconds or on tap.

#### Step 3.3 — XP toast notification
- **File:** `components/XpToast.tsx` *(NEW)*
- A small floating "+10 XP" badge that slides in from the top/bottom after each AI reply.
- Animate in → hold 1.5s → animate out.

#### Step 3.4 — Improved chat message animations
- **File:** `app/quest/page.tsx` *(MODIFY)*
- Add slide-in animation for new messages (user slides right, AI slides left).
- Typing indicator animation improvements.

#### Step 3.5 — Mic recording visual feedback
- **File:** `app/quest/page.tsx` and/or `components/MicButton.tsx` *(MODIFY)*
- Pulsing red ring/glow around the mic button while recording.
- Waveform or dot animation to show active listening.

#### Step 3.6 — Bottom nav active state micro-animation
- **File:** `components/BottomNav.tsx` *(MODIFY)*
- Add a subtle scale + color transition when switching tabs.
- Consider a small dot indicator under the active tab.

#### Step 3.7 — Loading skeletons polish
- **File:** `app/dashboard/loading.tsx`, `app/leaderboard/loading.tsx` *(MODIFY)*
- Ensure skeleton screens use shimmer/pulse effects consistently.

#### Step 3.8 — Dark mode support (bonus)
- **File:** `app/globals.css` *(MODIFY)*
- Add a `.dark` variant of the CSS custom properties.
- Add a theme toggle to the layout or dashboard.

---

## 📁 Folder Structure Recommendations

### Current issues:
1. **`test-gemini.mjs`** sits in the project root — should be moved to a `scripts/` folder or deleted before submission.
2. **No `hooks/` directory** — the new `useSpeechToText` hook needs a home.
3. **`getLevelFromXp()`** is duplicated / defined locally in `app/dashboard/page.tsx` — should be centralized.
4. **No shared gamification logic** — XP constants are scattered (hardcoded in homepage, dashboard).

### Recommended structure:
```
f:\lvlup\
├── app/
│   ├── api/
│   │   ├── chat/route.ts          (existing)
│   │   └── xp/route.ts            (NEW — Phase 2)
│   ├── dashboard/
│   ├── leaderboard/
│   ├── levels/
│   ├── login/
│   ├── quest/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                         (existing: avatar, button, card, progress)
│   ├── BottomNav.tsx               (existing)
│   ├── LevelUpModal.tsx            (NEW — Phase 3)
│   ├── MicButton.tsx               (NEW — Phase 1, optional)
│   └── XpToast.tsx                 (NEW — Phase 3)
├── config/
│   └── gameData.ts                 (existing)
├── hooks/
│   └── useSpeechToText.ts          (NEW — Phase 1)
├── lib/
│   ├── supabase/                   (existing: client, server, types)
│   ├── gamification.ts             (NEW — Phase 2)
│   └── utils.ts                    (existing)
├── scripts/
│   └── test-gemini.mjs             (MOVED from root)
├── supabase/
│   └── migrations/001_profiles.sql (existing)
├── CHANGELOG.md                    (NEW)
├── PLANNING.md                     (NEW — this file)
└── ...config files
```

---

## ✅ Verification Plan

### After Phase 1 (Speech-to-Text):
- Open the quest page → tap the mic → speak in Arabic → verify transcript appears in the input field.
- Test on Chrome (primary support) and check graceful fallback on unsupported browsers.

### After Phase 2 (Gamification):
- Send a chat message → verify XP is incremented in Supabase `profiles` table.
- Check that the dashboard and homepage reflect updated XP/level.
- Send enough messages to trigger a level-up → verify the level-up response.

### After Phase 3 (UI/UX):
- Navigate between pages → verify smooth transitions.
- Trigger a level-up → verify the celebration overlay appears.
- Test mic visual feedback during recording.
- Review all pages on mobile viewport (375px width).
