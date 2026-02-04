# AI Agent Context - Trivrdy Jeopardy Application

## TL;DR for AI Agents

This is a **Next.js 14 Jeopardy study application** called Trivrdy. It helps users practice with real Jeopardy questions.

**Quick Stats:**
- ~262 source files, ~60K lines of code
- Next.js 14 + TypeScript + Prisma + PostgreSQL + Clerk Auth
- 80+ API endpoints, 67 achievements, AI-powered answer checking

**Critical Files to Know:**
- `src/app/lib/answer-checker.ts` - AI semantic answer matching (446 lines - needs refactor)
- `src/lib/achievements.ts` - 67 achievement checks (716 lines - needs refactor)
- `src/lib/clerk-auth.ts` - Auth utilities (321 lines)
- `prisma/schema.prisma` - Database schema

**When Modifying Code:**
1. ✅ Check `docs/AI_OPTIMIZATION_PLAN.md` for full strategy
2. ✅ Run tests: `npm run test` or `npm run test:run`
3. ✅ Check types: `npm run typecheck`
4. ✅ Check lint: `npm run lint`
5. ✅ Never break existing features - gradual refactoring only

---

## Architecture Overview

### Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **Auth:** Clerk
- **Database:** PostgreSQL with pgvector extension
- **ORM:** Prisma 6
- **Styling:** Tailwind CSS 3
- **State:** TanStack React Query
- **AI/ML:** OpenAI embeddings, Xenova transformers (for semantic answer matching)

### Directory Structure
```
src/
├── app/
│   ├── api/              # API routes (80+ endpoints)
│   ├── (auth)/           # Auth group (sign-in, sign-up)
│   ├── (game)/           # Game pages
│   ├── (practice)/       # Practice/study pages
│   ├── admin/            # Admin dashboard
│   ├── daily-challenge/  # Daily challenge feature
│   ├── game/             # Game hub
│   ├── practice/         # Practice modes
│   ├── stats/            # User statistics
│   └── leaderboard/      # Leaderboard
├── components/           # Shared components (8 total)
├── lib/                  # Utilities and business logic
│   ├── prisma.ts         # Database client
│   ├── clerk-auth.ts     # Auth utilities
│   ├── achievements.ts   # Achievement system (716 lines!)
│   ├── game-utils.ts     # Game logic
│   └── api-utils.ts      # API helpers
└── types/                # TypeScript definitions
```

### Key Business Logic
1. **Answer Checking** - Uses AI semantic matching + rule-based fallbacks
2. **Achievements** - 67 different achievements tracked across events
3. **Game System** - Resumable games with Jeopardy board simulation
4. **Daily Challenge** - Daily Final Jeopardy questions

---

## Common Patterns

### API Route Pattern
```typescript
// src/app/api/[feature]/route.ts
import { requireAuth, jsonResponse, errorResponse } from '@/lib/api-utils';

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    
    // Business logic here
    
    return jsonResponse({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
```

### Database Query Pattern
```typescript
// Use prisma client from lib/prisma.ts
import { prisma } from '@/lib/prisma';

const result = await prisma.game.findUnique({
  where: { id },
  include: {
    questions: {
      include: { question: true }
    }
  }
});
```

### Authentication Pattern
```typescript
import { getClerkUserId, syncClerkUserToPrisma } from '@/lib/clerk-auth';

const userId = await getClerkUserId();
if (!userId) {
  return jsonResponse({ error: 'Unauthorized' }, 401);
}

const user = await syncClerkUserToPrisma(userId);
```

### Achievement Event Pattern
```typescript
import { triggerAchievementCheck } from '@/lib/achievements';

// Trigger after significant events
triggerAchievementCheck('game_completed', {
  userId: user.id,
  gameId: game.id,
  finalScore: game.score,
});
```

---

## Important Constraints

### Database Constraints
- **pgvector extension** required for embeddings
- **Vector size:** 1536 dimensions (OpenAI embeddings)
- **User model** has 19 relations - watch for N+1 queries

### Auth Constraints
- **Dual auth remnants:** NextAuth models still in schema (deprecated)
- **Role checking:** Happens at API level, not middleware
- **Admin emails:** Configured via `ADMIN_EMAILS` env var

### Performance Constraints
- **Xenova transformers** loaded dynamically (large bundle)
- **Embedding cache** limited to 10,000 entries
- **Guest sessions** have TTL-based expiration

### Business Rules
- **Max 3 active games** per user
- **Board requires 30 questions** (6 categories × 5 values)
- **Spoiler protection** blocks recent episode questions
- **Daily challenge** timezone-aware (America/New_York)

---

## Testing

### Current State
- **Only 1 test file:** `src/app/lib/answer-checker.test.ts`
- **Test framework:** Vitest
- **Coverage:** <5%

### Running Tests
```bash
npm run test       # Watch mode
npm run test:run   # Run once
```

### Writing Tests
```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from './module';

describe('feature', () => {
  it('should do something', () => {
    const result = functionToTest();
    expect(result).toBe(expected);
  });
});
```

---

## Database Schema (Key Models)

### User
- Syncs with Clerk authentication
- Tracks streaks, display names, avatars
- Role-based access (USER/ADMIN)

### Question
- Actual Jeopardy questions
- Has vector embeddings for semantic search
- Links to Category

### Game
- Resumable game sessions
- Tracks state, score, progress
- Links to User and Questions

### Achievement/UserAchievement
- 67 achievement definitions
- Tracks user unlocks

### DailyChallenge/UserDailyChallenge
- Daily Final Jeopardy questions
- Tracks completion and streaks

---

## Environment Variables

### Required
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/trivrdy"
DIRECT_URL="postgresql://user:pass@localhost:5432/trivrdy"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
```

### Optional
```env
ADMIN_EMAILS="admin@example.com"
OPENAI_API_KEY="sk-..."  # For embeddings
```

---

## Commands

### Development
```bash
npm run dev              # Start dev server
npm run dev:docker       # Docker dev mode
docker compose up -d db  # Start database
```

### Database
```bash
npm run db:setup         # Full setup
npm run db:migrate:dev   # Create migration
npm run db:seed          # Seed data
npm run db:fetch         # Fetch J-Archive questions
```

### Quality
```bash
npm run lint             # ESLint
npm run typecheck        # TypeScript
npm run validate         # Both
```

---

## Refactoring Priorities (High → Low)

### 🔴 Critical (Do First)
1. **Modularize achievements.ts** (716 lines → strategy pattern)
2. **Modularize answer-checker.ts** (446 lines → strategies)
3. **Add comprehensive tests** (currently <5% coverage)

### 🟡 High Priority
4. **Consolidate auth utilities** (duplicate logic in api-utils.ts + clerk-auth.ts)
5. **Add JSDoc documentation** to all public functions
6. **Create repository pattern** for database access

### 🟢 Medium Priority
7. **Reorganize API routes** (feature-based structure)
8. **Create service layer** for business logic
9. **Component library** structure

### ⚪ Low Priority
10. **Storybook documentation**
11. **Code generation CLI**
12. **Performance monitoring**

See `AI_OPTIMIZATION_PLAN.md` for detailed implementation guide.

---

## Common Pitfalls

### ❌ Don't Do
1. **Don't use `any`** - Strict TypeScript enabled
2. **Don't add console.log** - Use structured logger
3. **Don't exceed 300 lines** per file (split into modules)
4. **Don't break existing tests** - Always run tests first
5. **Don't change API signatures** without backward compatibility

### ✅ Do This
1. **Add JSDoc** to all exported functions
2. **Write tests** for new functionality
3. **Use repository pattern** for database queries
4. **Follow existing naming** conventions
5. **Check AI_OPTIMIZATION_PLAN.md** for patterns

---

## Getting Help

### Documentation
- `AI_OPTIMIZATION_PLAN.md` - Full optimization strategy
- `README.md` - Setup and development guide
- `docs/DEVELOPMENT.md` - Detailed development docs

### Files to Understand First
1. `src/lib/achievements.ts` - How achievements work
2. `src/app/lib/answer-checker.ts` - How answers are validated
3. `src/lib/game-utils.ts` - Game logic
4. `prisma/schema.prisma` - Data model

### Quick Questions Answered
- **How are answers checked?** → AI semantic matching → rule-based → fuzzy fallback
- **How do achievements work?** → Event-driven checks on user actions
- **How is auth handled?** → Clerk → Prisma sync → middleware protection
- **How are questions categorized?** → OpenAI embeddings + pgvector similarity

---

## AI Agent Best Practices

### Before Making Changes
1. Read the relevant section in `AI_OPTIMIZATION_PLAN.md`
2. Understand existing tests (if any)
3. Check for similar patterns in the codebase
4. Ensure you understand the business context

### Making Changes
1. Follow existing code style (check neighboring files)
2. Add/update tests for changes
3. Add JSDoc for new functions
4. Run `npm run validate` before committing

### After Changes
1. Run full test suite
2. Check for TypeScript errors
3. Verify no lint errors
4. Update documentation if needed

---

## Quick Fixes for Common Issues

### "Function too complex" error
```typescript
// Split into smaller functions
// Before: 100-line function
// After: Main function + 3-4 helper functions
```

### "Missing type" error
```typescript
// Add explicit return types
async function getUser(id: string): Promise<User | null> {
  // implementation
}
```

### "Test failed" error
```typescript
// Check test fixtures and database state
// Ensure test isolation (clean state between tests)
```

---

## Version History

- **v1.0** (2026-02-03) - Initial AI context documentation

---

*This document is optimized for AI agents. For human developers, see README.md and docs/DEVELOPMENT.md*
