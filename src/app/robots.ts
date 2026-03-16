import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://trivrdy.com'
        : 'http://localhost:3000'

    return {
        rules: [
            {
                userAgent: '*',
                allow: ['/'],
                disallow: [
                    '/api/',
                    '/admin/',
                    '/settings/',
                    '/sign-in/',
                    '/sign-up/',
                    '/game/*/',
                    '/stats',
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    }
}
