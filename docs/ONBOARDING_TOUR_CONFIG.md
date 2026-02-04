# Onboarding Tour Configuration

## Current Behavior: Restart on Refresh

**As of the latest commit**, the onboarding tour will **always restart on page refresh**. This means:
- Every time the user reloads the page, they will see the tour again
- The tour completion state is NOT persisted between sessions
- This is useful for testing and ensuring users always see the tour

### How it Works

The `useOnboarding` hook in `/src/app/hooks/useOnboarding.ts` now clears the completion state on every mount:

```typescript
// Always show tour on mount (restart on refresh behavior)
localStorage.removeItem(ONBOARDING_KEY)
localStorage.setItem(ONBOARDING_STEP_KEY, '0')
```

## How to Reverse: Persist Tour Completion

To restore the original behavior where the tour is only shown once per user:

### Step 1: Modify useOnboarding.ts

**File**: `/src/app/hooks/useOnboarding.ts`

**Current Code** (lines 22-38):
```typescript
useEffect(() => {
    // RESTART ON REFRESH: Always show tour on page load
    // To revert: Uncomment the persistence logic below and remove this block
    
    // Always show tour on mount (restart on refresh behavior)
    localStorage.removeItem(ONBOARDING_KEY)
    localStorage.setItem(ONBOARDING_STEP_KEY, '0')
    if (userId) {
        localStorage.setItem(ONBOARDING_USER_KEY, userId)
    }
    setState({
        isComplete: false,
        currentStep: 0,
        showTour: true
    })
    
    /* 
    // PERSISTENCE LOGIC (uncomment to restore):
    ...
    */
}, [userId])
```

**Change To**:
```typescript
useEffect(() => {
    // Check if this is a different user than before
    const lastUserId = localStorage.getItem(ONBOARDING_USER_KEY)
    const isNewUser = userId && lastUserId !== userId
    
    // If new user, reset onboarding state
    if (isNewUser) {
        localStorage.removeItem(ONBOARDING_KEY)
        localStorage.setItem(ONBOARDING_USER_KEY, userId)
        setState({
            isComplete: false,
            currentStep: 0,
            showTour: true
        })
        return
    }
    
    // Check localStorage on mount
    const isComplete = localStorage.getItem(ONBOARDING_KEY) === 'true'
    const savedStep = parseInt(localStorage.getItem(ONBOARDING_STEP_KEY) || '0', 10)
    
    setState({
        isComplete,
        currentStep: savedStep,
        showTour: !isComplete
    })
}, [userId])
```

### Step 2: Clear localStorage (if needed)

If users have already seen the tour with the "restart on refresh" version, they may have stale data. To ensure clean state:

```javascript
// Run in browser console:
localStorage.removeItem('trivrdy-onboarding-completed')
localStorage.removeItem('trivrdy-onboarding-step')
localStorage.removeItem('trivrdy-onboarding-user')
```

Or modify the useEffect temporarily to force clear:
```typescript
useEffect(() => {
    // Force clear all onboarding data on next load
    localStorage.removeItem('trivrdy-onboarding-completed')
    localStorage.removeItem('trivrdy-onboarding-step')
    localStorage.removeItem('trivrdy-onboarding-user')
    
    // Then run normal persistence logic...
}, [userId])
```

### Step 3: Rebuild and Deploy

```bash
npm run build
# or
docker compose up -d --build web
```

## Behavior Comparison

| Feature | Restart on Refresh (Current) | Persist Completion (Original) |
|---------|------------------------------|-------------------------------|
| Shows on first visit | ✅ Yes | ✅ Yes |
| Shows on refresh | ✅ Yes | ❌ No |
| Shows for returning users | ✅ Yes | ❌ No (if completed) |
| Useful for testing | ✅ Excellent | ⚠️ Requires clearing storage |
| User experience | ⚠️ Can be annoying | ✅ Shows once |

## Mobile Detection

The tour automatically hides on mobile devices. Detection uses:

1. **Viewport width**: `window.innerWidth < 768`
2. **User agent string**: Checks for mobile device patterns

The tour will not show if either condition is true.

To adjust the mobile breakpoint, edit `/src/app/components/OnboardingTour.tsx`:

```typescript
const isMobileDevice = () => {
    if (typeof window === 'undefined') return false
    const isMobileWidth = window.innerWidth < 768  // Change this value
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    return isMobileWidth || isMobileUA
}
```

## Tour Steps

The tour consists of 4 steps:

1. **Step 0 (Banner)**: Welcome banner at bottom of page - doesn't block interaction
2. **Step 1**: Daily Challenge card highlight
3. **Step 2**: Play Full Games card highlight (arrow on left)
4. **Step 3**: Study Mode card highlight (arrow on right)

### To Modify Steps

Edit the `tourSteps` array in `/src/app/components/OnboardingTour.tsx`:

```typescript
const tourSteps: TourStep[] = [
    {
        targetId: null,              // null for banner
        title: 'Welcome!',
        description: '...',
        position: 'bottom',
        isBanner: true               // true for banner step
    },
    {
        targetId: 'element-id',      // ID of element to highlight
        title: 'Title',
        description: 'Description',
        position: 'bottom',          // tooltip position
        arrowPosition: 'center'      // 'left', 'center', or 'right'
    },
    // ... more steps
]
```

### Arrow Positioning

- `arrowPosition: 'left'` - Arrow at left side of tooltip
- `arrowPosition: 'center'` - Arrow centered (default)
- `arrowPosition: 'right'` - Arrow at right side of tooltip

## Click-Through Behavior

The current implementation:
- **Backdrop**: Semi-transparent overlay that doesn't block clicks (`pointer-events: none`)
- **Highlight ring**: Visual indicator around target element
- **Users can**: Click through to interact with the page
- **Tour closes**: Automatically when user clicks a link/button that navigates away
- **X button**: Available on each tooltip to manually close

The tour does NOT automatically close when clicking outside the tooltip - users must use the X button or complete/skip the tour.

## Customization Options

### Change Banner Position

Currently the banner is fixed at the bottom. To change to top:

```typescript
// In OnboardingTour.tsx, find the banner return statement:
<div
    ref={tooltipRef}
    className="fixed bottom-0 left-0 right-0 z-50..."  // Change bottom-0 to top-0
>
```

### Change Tooltip Size

```typescript
const TOOLTIP_WIDTH = 340   // Change width
const TOOLTIP_HEIGHT = 220  // Change height
```

### Change Animation Speed

Edit the CSS classes in the component:
- `animate-fade-in` - Backdrop fade
- `animate-fade-in-up` - Tooltip appearance
- `animate-pulse` - Highlight ring pulse

## Troubleshooting

### Tour not showing
1. Check if on mobile (viewport < 768px)
2. Check if `showTour` is true in localStorage
3. Verify target element IDs exist in the DOM

### Tooltip positioned incorrectly
1. Check that target element has correct ID
2. Verify element is visible in viewport
3. Adjust `GAP` or `VIEWPORT_MARGIN` constants

### Arrow in wrong position
Check the `arrowPosition` property in the tour step configuration.
