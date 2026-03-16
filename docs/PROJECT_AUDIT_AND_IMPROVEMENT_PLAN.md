# Jeopardy Project Audit & Improvement Plan

## Completed Items (Current Sprint)

- [x] Unify grading with the async AI-first answer checker (`src/lib/answer-overrides.ts:1`, `src/app/api/answers/grade/route.ts:56`, `src/app/api/daily-challenge/route.ts:160`, `src/app/api/daily-challenge/archive/submit/route.ts:88`).
- [x] Restrict `/api/stats` to user-owned/admin-only `userId` lookups (`src/app/api/stats/route.ts:27`).
- [x] Normalize admin auth response handling in `requireAdmin()` routes using `clerk-auth` throws (`src/app/api/admin/users/route.ts:13`, `src/app/api/admin/users/send-email/route.ts:12`, `src/app/api/admin/users/[userId]/route.ts:17`).
- [x] Sanitize answer exposure for public board/final payloads via optional reveal flag (`src/app/api/categories/game/route.ts:190`, `src/app/api/game/final/route.ts:100`).
- [x] Update game clients to request revealed answers when expected by UI (`src/app/game/board/page.tsx:120`, `src/app/game/board/page.tsx:378`, `src/app/game/board/page.tsx:456`, `src/app/game/[gameId]/GameBoardClient.tsx:461`).
- [x] Hash/mask IPs before persisting API request telemetry (`src/lib/api-instrumentation.ts:220`, `src/lib/api-instrumentation.ts:232`, `src/lib/api-instrumentation.ts:254`, `src/lib/api-instrumentation.ts:304`).
- [x] Add defensive rate limiting to public issue submission endpoint (`src/app/api/issues/route.ts:13`).
- [x] Align production metadata canonical URLs around one canonical host (`src/app/layout.tsx:21`, `src/app/layout.tsx:35`, `src/app/layout.tsx:161`).
- [x] Add per-action payload shaping for practice/guest and archive endpoints (`src/app/api/questions/route.ts`, `src/app/api/practice/guest-question/route.ts`, `src/app/api/daily-challenge/archive/route.ts`, `src/app/api/daily-challenge/archive/submit/route.ts`, `src/app/api/practice/guest-question/complete/route.ts`).
- [x] Replace ad-hoc alert/toaster usage with a global feedback surface (`src/app/**/*.tsx`).
- [x] Introduce answer anti-cheat hardening for non-owner game resume/reveal workflows (`src/app/api/categories/game/route.ts`, `src/app/api/game/final/route.ts`, `src/app/game/board/page.tsx`, `src/app/game/[gameId]/GameBoardClient.tsx`).
- [x] Remove remaining auth mismatch patterns in admin routes that still threw inside `try`/`catch` without mapping (`src/app/api/admin/disputes/stats/route.ts`, `src/app/api/admin/player-games/route.ts`, `src/app/api/admin/disputes/[id]/approve/route.ts`, `src/app/api/admin/disputes/[id]/reject/route.ts`, `src/app/api/admin/cron-jobs/[jobName]/trigger/route.ts`).
- [x] Add reveal-aware payload shaping for guest game answer submission (`src/app/api/games/guest/[guestGameId]/answer/route.ts`, `src/app/play/guest-game/[guestGameId]/page.tsx`, `src/app/play/guest-question/page.tsx`).
- [x] Default-hide direct question detail answer fields unless explicitly requested (`src/app/api/questions/[questionId]/route.ts`, `src/app/game/[gameId]/GameBoardClient.tsx`).
- [x] Consolidate Next config ambiguity by removing dual `next.config.*` files and merging settings (`next.config.ts`, `next.config.js` deleted).
- [x] Add adaptive study recommendations endpoint and dashboard panel (`src/lib/study-scheduler.ts`, `src/app/api/stats/recommendations/route.ts`, `src/app/practice/PracticeRecommendationsPanel.tsx`).
- [x] Extend cron execution guardrails with explicit timeout and result-size caps (`src/lib/cron-logger.ts`, `src/app/api/admin/cron-jobs/[jobName]/trigger/route.ts`, `src/app/api/admin/cron-jobs/route.ts`, `src/app/api/cron/issues-summary/route.ts`, `src/app/api/cron/dispute-summary/route.ts`, `src/app/api/cron/fetch-questions/route.ts`, `src/app/api/cron/daily-challenge/route.ts`, `src/lib/daily-challenge-cron.ts`, `src/lib/cron-jobs.ts`).
- [x] Add tests for adaptive scheduler logic and privilege helper transitions (`src/lib/study-scheduler.test.ts`, `src/lib/api-utils.test.ts`).
- [x] Add explanation mode for wrong answers with detailed hints (`src/app/practice/components/PracticeAnswerExplanation.tsx`, `src/app/practice/category/page.tsx`, `src/app/practice/round/[round]/page.tsx`, `src/app/practice/round/final/page.tsx`, `src/app/practice/triple-stumpers/page.tsx`).
- [x] Add social feature MVP (`src/lib/friends.ts`, `src/app/api/friends/*`, `src/app/friends/FriendsClient.tsx`).
  - [x] Send, respond to, and list friend requests (`/api/friends/request`, `/api/friends/response`, `/api/friends`).
  - [x] Friend activity feed with actor/target visibility (`/api/friends/activity`, `src/app/friends/FriendsClient.tsx`).
  - [x] Friend streak comparison endpoint and UI (`/api/friends/streak-comparison`, `src/app/friends/FriendsClient.tsx`).
  - [x] Friend-only leaderboard API support (`/api/leaderboard?scope=friends`, `src/app/leaderboard/page.tsx`, `src/app/leaderboard/LeaderboardClient.tsx`, `/api/friends/leaderboard`).
  - [x] Friend-to-friend challenges (`/api/challenges/friends`, challenge create/accept/decline/cancel/complete flows).
  - [x] Friend removal endpoint and UI action (`/api/friends/remove`, `src/app/friends/FriendsClient.tsx`).
  - [x] Add current-vs-friend streak delta output (`/api/friends/streak-comparison`, `src/app/friends/FriendsClient.tsx`).
- [x] Keep practice explanation mode functional in all rounds by fixing imports and payload shape (`src/app/practice/category/page.tsx`, `src/app/practice/round/final/page.tsx`, `src/app/practice/triple-stumpers/page.tsx`, `src/app/practice/components/PracticeAnswerExplanation.tsx`).
- [x] Ensure social-feature TypeScript compatibility for new APIs (`src/lib/friends.ts`, `src/app/api/friends/*`, `src/app/api/challenges/friends/route.ts`).
- [x] Add challenge completion UX in Friends Hub with challenger/opponent score entry and completion state (`src/app/friends/FriendsClient.tsx`, `src/app/api/challenges/friends/route.ts`).
- [x] Upgrade Friend activity feed display to typed, human-readable summaries by event type and challenge metadata (`src/app/friends/FriendsClient.tsx`).
- [x] Add richer challenge-completion challenge UX feedback (winner preview + role-aware score labels, clearer completion validation) in Friends Hub (`src/app/friends/FriendsClient.tsx`).
- [x] Add activity feed improvements: avatar-backed actor/target display, relative timestamps, tone badges, and filter chips (`src/app/api/friends/activity/route.ts`, `src/app/friends/FriendsClient.tsx`).
- [x] Add challenge expiry awareness in challenge feed (pending expiring reminders and server-side expiry cleanup pass) (`src/app/api/challenges/friends/route.ts`, `src/app/friends/FriendsClient.tsx`).
- [x] Harden friend activity filtering input parsing (`src/app/api/friends/activity/route.ts`) with explicit normalization, invalid-type rejection, and case-tolerant list handling.
- [x] Close Friends client activity formatting gaps (completed events + blocked event handling) and reduce hook dependency warnings in `FriendsClient`.

## Deep Backlog (Next Wave)

- [x] Add optional challenge expiry reminders + auto-expire background cleanup when players ignore pending challenges.
- [ ] Add friend discovery privacy toggles:
  - [ ] Opt-in/opt-out visibility mode (full profile vs streak-only).
  - [ ] Block list support and request filtering.
- [ ] Add social interaction quality of life:
  - [ ] Emoji reactions for milestones.
- [ ] Add invite flow for non-registered users (email invite + referral code).
- [ ] Add weekly reset friend competition summaries and trends in activity feed.
- [ ] Add weekly/final streak leaderboard reset logic for friend-specific periods.
- [ ] Add end-to-end tests for friends/challenge APIs and FriendsClient interactions.
- [ ] Resolve baseline lint debt in admin and gameplay components (`eslint` currently reports many pre-existing errors).
- [ ] Make semantic answer checker tests resilient to offline environments (mock external model fallback expectations).
- [ ] Remove legacy / unreachable references to old auth assumptions across docs and scripts where still present.
