/**
 * Cron Jobs Configuration
 * 
 * Shared configuration for cron jobs used by admin APIs
 */

// Known cron jobs configuration
export const CRON_JOBS = {
    'daily-challenge': {
        name: 'Daily Challenge Generation',
        description: 'Generates daily challenges for today and next 7 days',
        schedule: '0 2 * * *',
        endpoint: '/api/cron/daily-challenge',
    },
    'fetch-questions': {
        name: 'Fetch Questions',
        description: 'Fetches yesterday\'s Jeopardy questions from J-Archive',
        schedule: '0 9 * * *',
        endpoint: '/api/cron/fetch-questions',
    },
    'fetch-games': {
        name: 'Fetch Games',
        description: 'Fetches games for the last 7 days (internal cron)',
        schedule: '0 3 * * *',
        endpoint: null, // Internal cron job, no API endpoint
    },
} as const

export type CronJobName = keyof typeof CRON_JOBS

