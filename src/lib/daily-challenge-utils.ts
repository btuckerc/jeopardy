/**
 * Utility functions for daily challenge timing
 * 
 * The daily challenge unlocks at 9:00 AM America/New_York (ET).
 * This handles DST automatically via the Intl API.
 */

const TIMEZONE = 'America/New_York'
const UNLOCK_HOUR = 9 // 9 AM ET

/**
 * Get the current time components in America/New_York timezone
 */
function getETComponents(date: Date = new Date()): {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
} {
    // Use Intl.DateTimeFormat to get components in ET
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    })

    const parts = formatter.formatToParts(date)
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10)

    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour') === 24 ? 0 : get('hour'), // Handle midnight edge case
        minute: get('minute'),
        second: get('second'),
    }
}

/**
 * Convert an ET date/time to a UTC Date object
 * @param year Full year in ET
 * @param month Month (1-12) in ET
 * @param day Day of month in ET
 * @param hour Hour (0-23) in ET
 * @param minute Minute in ET
 * @param second Second in ET
 */
function etToUTC(year: number, month: number, day: number, hour: number = 0, minute: number = 0, second: number = 0): Date {
    // Create a date string that we can parse with timezone
    // Format: YYYY-MM-DDTHH:mm:ss
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
    
    // Use a trick: create a formatter that outputs in UTC, then parse
    // We need to find the UTC equivalent of the given ET time
    
    // First, create a rough estimate
    const roughDate = new Date(dateStr + 'Z')
    
    // Get the offset by checking what ET time this UTC time maps to
    const etParts = getETComponents(roughDate)
    
    // Calculate the difference in hours between what we want and what we got
    const hourDiff = hour - etParts.hour
    let dayDiff = day - etParts.day
    
    // Handle day wraparound
    if (dayDiff > 15) dayDiff -= 30 // Month boundary
    if (dayDiff < -15) dayDiff += 30
    
    // Adjust the rough date
    const adjustedMs = roughDate.getTime() + (hourDiff * 60 * 60 * 1000) + (dayDiff * 24 * 60 * 60 * 1000)
    const adjusted = new Date(adjustedMs)
    
    // Verify and fine-tune (handles DST edge cases)
    const verifyParts = getETComponents(adjusted)
    if (verifyParts.hour !== hour || verifyParts.day !== day) {
        // One more adjustment if needed
        const finalHourDiff = hour - verifyParts.hour
        const finalDayDiff = day - verifyParts.day
        return new Date(adjusted.getTime() + (finalHourDiff * 60 * 60 * 1000) + (finalDayDiff * 24 * 60 * 60 * 1000))
    }
    
    return adjusted
}

/**
 * Get the active challenge date key.
 * 
 * The "active" challenge is determined by 9AM ET boundary:
 * - Before 9AM ET: yesterday's challenge (by ET calendar) is active
 * - 9AM ET or later: today's challenge (by ET calendar) is active
 * 
 * Returns a Date object set to midnight UTC for the chosen YYYY-MM-DD.
 * This is the canonical key used in `dailyChallenge.date`.
 */
export function getActiveChallengeDate(now: Date = new Date()): Date {
    const et = getETComponents(now)
    
    let activeYear = et.year
    let activeMonth = et.month
    let activeDay = et.day
    
    // If before 9AM ET, use yesterday's date
    if (et.hour < UNLOCK_HOUR) {
        // Subtract one day
        const yesterday = new Date(Date.UTC(et.year, et.month - 1, et.day - 1, 12, 0, 0)) // Use noon to avoid DST issues
        const yParts = {
            year: yesterday.getUTCFullYear(),
            month: yesterday.getUTCMonth() + 1,
            day: yesterday.getUTCDate(),
        }
        activeYear = yParts.year
        activeMonth = yParts.month
        activeDay = yParts.day
    }
    
    // Return as UTC midnight for this date (canonical DB key)
    return new Date(Date.UTC(activeYear, activeMonth - 1, activeDay, 0, 0, 0, 0))
}

/**
 * Get the active challenge date as an ISO date string (YYYY-MM-DD)
 */
export function getActiveChallengeDateString(now: Date = new Date()): string {
    const date = getActiveChallengeDate(now)
    return date.toISOString().split('T')[0]
}

/**
 * Get the timestamp for when the next daily challenge unlocks (9AM ET).
 * 
 * If it's currently before 9AM ET, returns today's 9AM ET.
 * If it's 9AM ET or later, returns tomorrow's 9AM ET.
 */
export function getNextChallengeTime(now: Date = new Date()): Date {
    const et = getETComponents(now)
    
    let nextYear = et.year
    let nextMonth = et.month
    let nextDay = et.day
    
    // If it's 9AM or later, the next unlock is tomorrow at 9AM
    if (et.hour >= UNLOCK_HOUR) {
        // Add one day
        const tomorrow = new Date(Date.UTC(et.year, et.month - 1, et.day + 1, 12, 0, 0)) // Use noon to avoid DST issues
        nextYear = tomorrow.getUTCFullYear()
        nextMonth = tomorrow.getUTCMonth() + 1
        nextDay = tomorrow.getUTCDate()
    }
    
    // Return the exact moment of 9AM ET on that day
    return etToUTC(nextYear, nextMonth, nextDay, UNLOCK_HOUR, 0, 0)
}

/**
 * Get the ISO string for the next daily challenge unlock time.
 * Safe to use in both server and client components.
 */
export function getNextChallengeTimeISO(now: Date = new Date()): string {
    return getNextChallengeTime(now).toISOString()
}

/**
 * Check if a new challenge is currently available (i.e., we're past the unlock time).
 * This is useful for client-side countdown logic.
 */
export function isChallengeUnlocked(challengeDate: Date, now: Date = new Date()): boolean {
    const activeDate = getActiveChallengeDate(now)
    return activeDate.getTime() >= challengeDate.getTime()
}