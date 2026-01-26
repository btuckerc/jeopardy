import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://www.trivrdy.com'
        : 'http://localhost:3000'

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/admin/', '/game/*/'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}

