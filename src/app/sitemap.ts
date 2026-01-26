import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://www.trivrdy.com'
        : 'http://localhost:3000'

    const routes = [
        {
            path: '',
            changeFrequency: 'daily' as const,
            priority: 1.0,
        },
        {
            path: '/daily-challenge',
            changeFrequency: 'daily' as const,
            priority: 0.9,
        },
        {
            path: '/game',
            changeFrequency: 'weekly' as const,
            priority: 0.9,
        },
        {
            path: '/practice',
            changeFrequency: 'weekly' as const,
            priority: 0.9,
        },
        {
            path: '/practice/category',
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        },
        {
            path: '/practice/round',
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        },
        {
            path: '/leaderboard',
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        },
        {
            path: '/stats',
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        },
        {
            path: '/help',
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        },
        {
            path: '/sign-in',
            changeFrequency: 'monthly' as const,
            priority: 0.5,
        },
        {
            path: '/sign-up',
            changeFrequency: 'monthly' as const,
            priority: 0.5,
        },
    ]

    return routes.map((route) => ({
        url: `${baseUrl}${route.path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
    }))
}

