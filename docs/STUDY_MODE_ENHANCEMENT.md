# Study Mode Enhancement Plan

## Current State Analysis

The current practice page has three main cards:
1. Study by Category - Knowledge-based categories
2. Study by Round - Single/Double/Final specific
3. Triple Stumpers - Hard questions

Below these are three more cards with duplicate/similar options:
1. By Category (again)
2. By Round (again)
3. Triple Stumpers (again)

**Problem**: The UI is confusing with duplicate entry points and no clear guidance on what to pick.

## Proposed Enhancement

### 1. Single Entry Point with Guided Path

Replace the 6 cards with a **single Learning Path** visualization:

```
Start Here
    ↓
Step 1: By Category
    ↓
Step 2: By Round
    ↓
Step 3: Triple Stumpers
    ↓
🏆 Mastery
```

**Behavior**:
- Each step unlocks after engaging with the previous
- Show completion percentage for each step
- Allow jumping ahead but clearly mark the recommended path
- Celebrate milestone completions

### 2. Smart Recommendations Engine

Instead of static cards, show **contextual suggestions**:

```
"Based on your 40% accuracy in Geography, 
we recommend practicing Geography today."


[Start Geography Session] [Show Me Other Options]
```

**Smart Sorting**:
1. Lowest accuracy categories first
2. Recently practiced (for spaced repetition)
3. Never attempted categories
4. Strong categories (for confidence building)

### 3. Session-Based Study Mode

Replace "Study Mode" with **Guided Sessions**:


**Quick Session** (5-10 min):
- System picks 5 questions based on weaknesses
- Immediate feedback
- Summary with next recommendations

**Deep Session** (20-30 min):
- User picks focus area
- 15-20 questions
- Detailed breakdown at end
- Achievement unlocks

**Spaced Repetition Mode** (Advanced):
- AI picks when to review
- Based on forgetting curve
- Shows "Review Today" list

### 4. Progress Visualization
Replace stats with **Visual Journey Map**:

```
Your Trivia Journey

🏔️  MOUNTAIN OF KNOWLEDGE
    /    \
   /      \
  /        \
🌊 SEA OF WISDOM
```

- Each peak = mastered category
- Depth = accuracy percentage  
- Color = engagement level
- Click to explore/practice

### 5. Zero-Friction Entry
**Guest Mode**:
- Start immediately, no signup
- Progress tracked locally
- "Sign up to save progress" banner after 3 games
- One-click upgrade preserves all data

**One-Touch Resume**:
- Biggest button = "Continue Your Game"
- Shows progress: "Round 2, Question 4"
- Estimated time remaining

## Technical Implementation

### New Components Needed
1. `LearningPath.tsx` - Visual step progression
2. `SmartRecommendations.tsx` - AI suggestions  
3. `SessionPicker.tsx` - Guided study modes
4. `JourneyMap.tsx` - Visual progress map
5. `ZeroFrictionEntry.tsx` - Guest → signup flow

### API Additions
1. `GET /api/practice/recommendations` - Smart picks
2. `POST /api/sessions/start` - Begin guided session
3. `GET /api/progress/journey` - Visual map data
### State Management
- Track completion per step
- Store session preferences
- Cache recommendations
- Sync guest → signed-in state

## Success Metrics

- Time to first study session: < 10 seconds
- Session completion rate: >70%
- Return rate for guided sessions: >60%
- Guest → signup conversion: >30%
- User-reported confusion score: <2/10

## Rollout Plan

### Week 1: Foundation
- Build LearningPath component
- Add session-based study modes
- Implement smart recommendations

### Week 2: Polish  
- Add Journey Map visualization
- Implement zero-friction entry
- Enhance with animations

### Week 3: Testing
- A/B test against current practice page
- Measure all success metrics
- Iterate based on feedback

### Week 4: Launch
- Full rollout to all users
- Monitor engagement
- Plan Phase 2 enhancements
