/**
 * Next.js Instrumentation Hook
 * 
 * This file runs once when the Next.js server starts.
 * Used to initialize background services like cron jobs.
 */

export async function register() {
    // Only run in production (Docker Compose deployment)
    if (process.env.NODE_ENV === 'production') {
        // Dynamically import to avoid loading in development
        const { startDailyChallengeCron } = await import('./lib/daily-challenge-cron')
        startDailyChallengeCron()
    }
}

