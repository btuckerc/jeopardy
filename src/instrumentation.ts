/**
 * Next.js Instrumentation Hook
 * 
 * This file runs once when the Next.js server starts.
 * Used to initialize background services like cron jobs and route warming.
 */

/**
 * Warm up critical routes by making internal requests
 * This triggers compilation early so users don't wait for cold starts
 */
async function warmRoutes() {
    // Only warm routes in server runtime
    if (typeof window !== 'undefined') return
    
    const port = process.env.PORT || 3000
    const baseUrl = `http://localhost:${port}`
    
    // Critical routes to warm up - ordered by importance
    const routes = [
        '/',                    // Homepage
        '/game',                // Game hub
        '/daily-challenge',     // Daily challenge
        '/leaderboard',         // Leaderboard
        '/practice',            // Practice hub
        '/help',                // Help page
        // API routes that are frequently hit
        '/api/categories/game?mode=random&round=SINGLE',
        '/api/game/final?mode=random',
        '/api/leaderboard',
    ]
    
    console.log('[Route Warming] Starting route pre-compilation...')
    const startTime = Date.now()
    
    for (const route of routes) {
        try {
            const url = `${baseUrl}${route}`
            // Use a short timeout - we just want to trigger compilation
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Route-Warmer/1.0',
                    'X-Route-Warming': 'true'
                }
            })
            clearTimeout(timeoutId)
            
            console.log(`[Route Warming] ${route} -> ${response.status}`)
        } catch (error) {
            // Ignore errors - route warming is best-effort
            if (error instanceof Error && error.name !== 'AbortError') {
                console.log(`[Route Warming] ${route} -> failed (${error.message})`)
            }
        }
    }
    
    const duration = Date.now() - startTime
    console.log(`[Route Warming] Completed in ${duration}ms`)
}

export async function register() {
    console.log('[Instrumentation] register() called, NEXT_RUNTIME:', process.env.NEXT_RUNTIME)
    
    // Only run in server runtime
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('[Instrumentation] Running in nodejs runtime')
        
        // Start daily challenge cron in production
        if (process.env.NODE_ENV === 'production') {
            const { startDailyChallengeCron } = await import('./lib/daily-challenge-cron')
            startDailyChallengeCron()
        }
        
        // Warm routes after a short delay to let the server fully start
        // This runs in both dev and prod to improve cold start times
        console.log('[Instrumentation] Scheduling route warming in 3 seconds...')
        setTimeout(() => {
            warmRoutes().catch(err => console.error('[Route Warming] Error:', err))
        }, 3000) // Wait 3 seconds for server to be ready
    }
}

