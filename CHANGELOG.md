# Changelog

All notable changes to the **LevelUp** project will be documented in this file.

---

## [0.1.0] — 2026-02-27

### ✅ Completed (Foundation)
- **Supabase Authentication** — Email/password sign-in and sign-up flow (`/login`).
- **Profiles DB Schema** — `profiles` table with `xp_points`, `current_streak`, `highest_streak`, `quests_completed`, auto-created on signup via trigger.
- **Gemini 2.5 Flash Integration** — Chat API route (`/api/chat`) with system instruction, multi-turn conversation history, and image (vision) support.
- **Quest Chat UI** — Full chat interface (`/quest`) with message bubbles, image preview/upload, and auto-scroll.
- **Text-to-Speech** — Browser `SpeechSynthesis` API to read AI responses aloud in Arabic, with mute/unmute toggle.
- **Dashboard** — Server-rendered profile page showing XP, level progress (circular + bar), streak, quests completed, and achievement badges.
- **Leaderboard** — Server-rendered top-20 leaderboard sorted by XP from Supabase.
- **Level Map** — Client-side winding path UI displaying 12 levels with lock/unlock states and XP rewards.
- **Bottom Navigation** — 4-tab bottom nav (Home, Levels, Leaderboard, Dashboard) with active state highlighting.
- **Theming** — Custom HSL color palette (pink background, amber text, blue primary, green success) via CSS custom properties + Tailwind.

- **Speech-to-Text** — Implemented `hooks/useSpeechToText.ts` using Web Speech API; wired mic button in `/quest` with real-time transcription and pulsing animation.
- **Gamification Logic** — Created `lib/gamification.ts` and `/api/xp` route to award XP after chat interactions (10 XP base, 25 XP with image).
- **UI/UX Polish** — Added Framer Motion animations for message entries, fluid typing indicator, premium floating XP toasts, and a full-screen level-up celebration with **canvas-confetti**.
- **AI Personalization** — Updated Chat API to fetch student XP/Level from Supabase; the tutor now dynamically adjusts its instruction (Beginner/Intermediate/Advanced) and greets students by name.
- **Visual Theme** — Finalized the "Pink/Blue/Yellow/Green" hackathon palette across `globals.css` and the Quest interface.

---

## [1.2.0] — 2026-02-27 (Startup Release)

### 🚀 Real Product Features
- **Adaptive Tutoring Brain** — Implemented level-aware system instructions in `route.ts`. AI now shifts between "Friendly Guide" (L1-3) and "The Challenger" (L7-12).
- **Daily Streak Engine** — Integrated automated streak tracking based on user engagement history in `lib/gamification.ts`.
- **Character Avatars** — Replaced initials with visual character placeholders to enhance student engagement.
- **Branding Refresh** — Finalized the official Startup palette (Pink/Blue/Yellow/Green) across all core components.
- **Investor Documentation** — Generated professional `README.md` (with system architecture) and a high-impact `PITCH.md` script for seed funding.

## [1.0.0] — 2026-02-27 (Hackathon v1)

### ✨ Phase 3 — UI/UX Polish
- [ ] Page transition animations
- [ ] Level-up celebration modal
- [ ] XP toast notifications
- [ ] Chat message slide-in animations
- [ ] Mic recording visual feedback
- [ ] Bottom nav micro-animations
- [ ] Loading skeleton polish
- [ ] Dark mode (bonus)
