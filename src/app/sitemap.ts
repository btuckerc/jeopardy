import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://www.trivrdy.com'
        : 'http://localhost:3000'

    const routes = [
        '',
        '/game',
        '/practice',
        '/leaderboard',
        '/stats',
        '/sign-in',
        '/sign-up',
    ]

    return routes.map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : route === '/game' || route === '/practice' ? 0.9 : 0.7,
    }))
}

