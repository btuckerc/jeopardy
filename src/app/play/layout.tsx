import { Metadata } from 'next'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
    title: 'Try trivrdy Free | Jeopardy Practice Game',
    description: 'Try trivrdy for free without signing up. Practice with random Jeopardy questions and experience the game before creating an account.',
    keywords: 'try jeopardy free, jeopardy guest mode, free trivia game, play without account, jeopardy demo',
    openGraph: {
        title: 'Try trivrdy Free | Jeopardy Practice Game',
        description: 'Try trivrdy for free without signing up. Practice with random Jeopardy questions.',
        url: 'https://trivrdy.com/play',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Try trivrdy Free | Jeopardy Practice Game',
        description: 'Try trivrdy for free without signing up. Practice with random Jeopardy questions.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/play',
    },
    robots: {
        index: true,
        follow: true,
    },
}

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://trivrdy.com',
        },
        {
            '@type': 'ListItem',
            position: 2,
            name: 'Try Free',
            item: 'https://trivrdy.com/play',
        },
    ],
}

export default function PlayLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <JsonLd data={breadcrumbSchema} />
            {children}
        </>
    )
}
