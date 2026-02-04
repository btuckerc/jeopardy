import { Metadata } from 'next'

import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
    title: 'Trivia Progress & Stats | Jeopardy Tracker - trivrdy',
    description: 'Track your trivia progress with detailed Jeopardy statistics. View accuracy, points earned, category performance, and answer history. Monitor your improvement over time.',
    keywords: 'trivia stats, jeopardy statistics, track trivia progress, trivia analytics, jeopardy performance, trivia tracking, progress tracker',
    openGraph: {
        title: 'Trivia Progress & Stats | Jeopardy Tracker - trivrdy',
        description: 'Track your trivia progress with detailed Jeopardy statistics. View accuracy, points earned, and category performance.',
        url: 'https://trivrdy.com/stats',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Trivia Progress & Stats | Jeopardy Tracker - trivrdy',
        description: 'Track your trivia progress with detailed Jeopardy statistics. View accuracy, points earned, and category performance.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/stats',
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
            name: 'Statistics',
            item: 'https://trivrdy.com/stats',
        },
    ],
}

export default function StatsLayout({
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

