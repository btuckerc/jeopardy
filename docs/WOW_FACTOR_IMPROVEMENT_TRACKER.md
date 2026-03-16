# Admin + UX Baseline Improvement Checklist

## Active Implementation

- [x] Accessibility fixes identified (friends input + leaderboard copy) and baseline plan acknowledged.
- [x] Implement friends/leaderboard accessibility contrast improvements.
- [x] Implement friend icon + intermediate breakpoint hamburger menu improvements.
- [x] Finish mechanical `any`/`as any` cleanup pass in `src/app/admin/AdminClient.tsx`.
- [x] Remove baseline lint debt across API and app modules.
- [x] Validate all changes with `npm run lint` and `npm run typecheck`.
- [x] Run regression build/check and confirm baseline improvements are in place.

## Core UX Fixes
- [x] Fix Friends page form field accessibility contrast and visual clarity for text inputs.
- [x] Improve Friends icon treatment in navbar to align with app icon language.
- [x] Add intermediate-size (md+<lg) navigation hamburger menu and keep Friends accessible.
- [x] Improve leaderboard low-contrast text (global/friends scope copy and key stats labels).

## Admin Baseline Typing Debt
- [x] Remove explicit `any` usage in `src/app/admin/AdminClient.tsx` from state and function signatures.
- [x] Replace unsafe map callback parameters currently using `any` with concrete types.
- [x] Replace `as any` casts with concrete enum/string union casts.
- [x] Type mutable payload objects (e.g., guest config updates) without `any`.
- [x] Remove unused state/actions and dead code in `src/app/admin/AdminClient.tsx` exposed by lint (`unused var` pass).

## Baseline Lint Cleanup
- [x] Remove unused imports/types and route parameter interfaces flagged by lint.
- [x] Fix unused local variables/state in leaderboard/friends/admin routes and game board.
- [x] Resolve hook dependency warnings in `GameHubClient.tsx` and `GameBoardClient.tsx`.
- [x] Remove unused state/actions (`useOnboarding`, `NextChallengeCallout`, `SkeletonLoader`) and clean utility dead code.
- [x] Validate full repo lint/typecheck pass with zero warnings.

## Notes

- Keep all checklist items updated as each task completes.
- Avoid removing unrelated features while normalizing typing and UX contrast.

## Verification
- [x] Run `npm run lint` and confirm no new lint regressions.
- [x] Run `npm run typecheck` and resolve all introduced TypeScript issues.
- [x] Rebuild Docker images outside sandbox using escalated execution after Dockerfile dependency cleanup.
- [x] Run production compose flow (`docker compose stop web`, `docker compose rm web`, `docker compose up -d --build web`) and confirm web container starts cleanly from rebuilt image.

## Feedback Refinements
- [x] Restore Friends Hub form inputs to light background with dark text for accessibility.
- [x] Rework the Friends navbar icon to match the rest of the nav icon style.
- [x] Keep the 3 core nav actions visible at intermediate widths while preserving hamburger access for the full menu.
- [x] Increase contrast for Friends Hub action buttons (`Compare`, `Block`, `Remove`, `Cancel`, `Challenge ...`) by defining missing `btn-outline` styles.

## Challenge Mode Enhancements (Current)
- [x] Add challenge composer settings so challenger can choose random vs chosen categories.
- [x] Add configurable category count (1-6) for game-mode challenges.
- [x] Add chosen-category search and selection UI in Friends Hub challenge composer.
- [x] Enforce chosen-mode category count/category validity in `/api/challenges/friends`.
- [x] Reconcile game-mode challenge scores from linked game state for in-progress score visibility.
- [x] Auto-complete game-mode challenge status when both participant challenge games are completed.
- [x] Add challenge board metadata (selected categories) to challenge payload for review context.
- [x] Make challenge completion popup mode-specific (no generic new-game wording in challenge flow).
- [x] Allow challenge round review from the completion popup without forcing immediate exit/new game.
- [x] Route challenge-mode exits back to `/friends` (header exit, completion actions, and profile prompt exit path).
- [x] Rebuild and redeploy with Docker compose flow (`stop web`, `rm web`, `up -d --build web`) and verify healthy startup logs.
- [x] Normalize failing `vitest` semantic-answer tests in Docker (`sharp` runtime / model-unavailable edge cases).

## Reliability + Scalability QA Sweep
- [x] Audit and enforce challenge state invariants in Docker DB (active uniqueness, timestamp consistency, score completeness).
- [x] Fix create-flow corner case where expired pending challenges could still block new challenge creation.
- [x] Ensure expiry reconciliation persists for challenge list loads even when status filter is `all`.
- [x] Add game challenge lookup indexes for `config->>'friendChallengeId'` and per-user challenge game lookup ordering.
- [x] Rebuild Docker image and verify migrations/index presence in running DB.
- [x] Re-run Docker QA gates: `lint`, `typecheck`, and full `vitest` suite.

## Reliability + Scalability QA Sweep (Extended)
- [x] Add DB-level race guards for one pending friend request per pair (bi-directional) and one active challenge per pair.
- [x] Add dedupe migration logic for historical duplicate pending friend requests/challenges before applying uniqueness indexes.
- [x] Add deterministic ordering to friend-request pair lookups (`updatedAt`, then `createdAt`) to avoid non-deterministic request resolution.
- [x] Persist expired challenge normalization on challenge list reads regardless of `includeExpired` filtering.
- [x] Add DB-level uniqueness for challenge activity (`challengeId` + `activityType`) after dedupe cleanup.
- [x] Add API-level graceful handling for race-triggered unique violations in friend request/challenge create flows.

## Challenge UX Follow-up
- [x] Add an explicit API action to end existing pending/accepted challenges (`action: end`) for either participant.
- [x] Surface active-challenge conflict details in challenge-create responses so the UI can offer a one-click recovery.
- [x] Add Friends Hub composer flow: `End Existing & Create New` when create hits `ACTIVE_CHALLENGE_EXISTS`.
- [x] Add explicit confirmation modal before ending/replacing active challenges to prevent accidental destructive clicks.
- [x] Ensure challenge-end confirmation flow returns users to Friends Challenges tab (`/friends?tab=challenges`).
- [x] Rename conflict secondary action from “Keep Existing” to “Cancel” for clearer destructive-action semantics.
- [x] Add global accepted-challenge toast notifications so challengers are notified even off the Friends page.
- [x] Reduce Add Friend prominence by scoping it to Requests tab only.
- [x] Increase per-friend challenge-entry prominence with direct primary Challenge action in Friends list rows.
- [x] Improve random challenge category selection to use unbiased random sampling (not deterministic top-ranked categories).
- [x] Add lightweight anti-repeat behavior for random mode by excluding the most recent board categories for that friend pair when possible.
- [x] Make game-mode challenge status copy compact and embedded in-row (no large expanded text block).
- [x] Make Friends list `Compare` action jump to Compare tab and trigger immediate comparison load.
- [x] Improve Friends row compare-status text to show loading and quick delta context instead of static “Comparison active”.
- [x] Rework challenge creation into a single modal flow (`New Challenge`) to reduce inline clutter.
- [x] Add in-modal friend selection so challenge creation is one click from any tab context.
- [x] Strengthen CTA hierarchy for challenge creation with one prominent primary submit action.
- [x] Make active-challenge conflict/error feedback modal-scoped and pinned near the top of the challenge composer for reliable visibility.
