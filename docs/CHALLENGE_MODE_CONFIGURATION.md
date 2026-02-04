# Challenge Mode Configuration: All Questions vs Triple Stumpers Only

## Current Default: ALL Questions from Triple Stumper Categories

**As of the latest commit**, Challenge Mode displays **ALL questions** from categories that contain triple stumpers.

### How It Works
1. Categories are selected based on having at least one triple stumper
2. ALL questions from those categories are displayed (not just triple stumpers)
3. The "challenge" comes from the category selection, not question filtering

### Benefits
- More playable boards (all 5 questions per category)
- Better game flow with mixed difficulty
- Categories are still curated to be challenging (they contain stumpers)

---

## How to Revert: Show Only Triple Stumpers

If you want to show **only triple stumper questions** (the original behavior), follow these steps:

### Step 1: Modify the Question Query Filter

**File**: `src/app/api/categories/game/route.ts`

**Current Code** (lines ~380-395):
```typescript
// CHALLENGE MODE: Show ALL questions from triple stumper categories
// Categories are selected based on containing triple stumpers, but we display all questions
// This provides the "challenge" through category selection, not question filtering
// NOTE: To revert to showing only triple stumpers, use the commented code below:
// const isTripleStumperCategory = tripleStumperCategoryIds.includes(categoryId)
// const categoryQuestionWhere = isTripleStumperCategory
//     ? { round: questionWhere.round, ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {}), wasTripleStumper: true }
//     : { round: questionWhere.round, ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {}) }

const categoryQuestionWhere = {
    round: questionWhere.round,
    ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {})
}
```

**Change To**:
```typescript
// Show only triple stumper questions from triple stumper categories
const isTripleStumperCategory = tripleStumperCategoryIds.includes(categoryId)
const categoryQuestionWhere = isTripleStumperCategory
    ? { round: questionWhere.round, ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {}), wasTripleStumper: true }
    : { round: questionWhere.round, ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {}) }
```

### Step 2: Consider Fallback Behavior

When showing only triple stumpers, you may want to adjust the fallback logic:

**Option A: Keep fallback to regular categories** (current default)
- If < 5 triple stumper categories exist, fills remaining slots with regular categories
- Regular categories show regular questions
- Triple stumper categories show only triple stumpers

**Option B: Remove fallback** (show only triple stumper categories)
- All categories must contain triple stumpers
- Game fails to load if insufficient triple stumper categories

To remove fallback, delete or comment out lines ~261-293:
```typescript
// REMOVE THIS ENTIRE BLOCK:
if (categoryFilter === 'TRIPLE_STUMPER' && eligibleCategoryIds.length < 5) {
    console.log(`[Challenge Mode] Only ${eligibleCategoryIds.length} triple stumper categories found...`)
    // ... rest of fallback logic
}
```

### Step 3: Rebuild and Test

```bash
npm run build
# or
docker compose up -d --build web
```

**Test checklist**:
- [ ] Start a Challenge Mode game
- [ ] Verify only triple stumper questions appear in triple stumper categories
- [ ] Check that categories have fewer questions (only triple stumpers)
- [ ] Ensure game logic still works correctly

---

## Technical Details

### Database Schema
```prisma
model Question {
  id               String   @id @default(uuid())
  wasTripleStumper Boolean  @default(false)
  // ... other fields
}
```

### Query Flow Comparison

**ALL Questions (Current)**:
```
1. Find categories with wasTripleStumper=true
2. For each selected category:
   - Query: { round: SINGLE, categoryId: "..." }
   - Returns: ALL questions (mix of regular + triple stumpers)
```

**Triple Stumpers Only (Revert)**:
```
1. Find categories with wasTripleStumper=true
2. For each selected category:
   - Query: { round: SINGLE, categoryId: "...", wasTripleStumper: true }
   - Returns: ONLY triple stumper questions
```

### Visual Indicators

If you want to show which questions are triple stumpers when displaying ALL questions, you could add UI badges:

**File**: `src/app/game/[gameId]/GameBoardClient.tsx`

Add a visual indicator using `question.wasTripleStumper`:
```typescript
{question.wasTripleStumper && (
    <span className="absolute top-1 right-1 text-xs">💀</span>
)}
```

---

## Quick Reference

### To Show ALL Questions (Current Default)
```typescript
const categoryQuestionWhere = {
    round: questionWhere.round,
    ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {})
}
```

### To Show Only Triple Stumpers
```typescript
const isTripleStumperCategory = tripleStumperCategoryIds.includes(categoryId)
const categoryQuestionWhere = isTripleStumperCategory
    ? { round: questionWhere.round, ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {}), wasTripleStumper: true }
    : { round: questionWhere.round, ...(questionWhere.airDate ? { airDate: questionWhere.airDate } : {}) }
```

---

## Decision Matrix

| Feature | ALL Questions | Triple Stumpers Only |
|---------|--------------|---------------------|
| Board completeness | ✅ Full 5x6 board | ⚠️ Sparse (1-5 per category) |
| Game difficulty | ✅ Curated categories | ⚠️ Very hard (all stumpers) |
| Playability | ✅ Better flow | ⚠️ May be too difficult |
| Category variety | ✅ More variety | ⚠️ Limited to stumper categories |

**Recommendation**: Keep ALL Questions for better user experience, unless you specifically want an "expert only" mode.
