import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Track Trivia Progress | Your Jeopardy Stats | trivrdy',
    description: 'Track your trivia progress and view detailed Jeopardy statistics. See your accuracy, points earned, category performance, and answer history.',
    keywords: 'trivia stats, jeopardy statistics, track trivia progress, trivia analytics, jeopardy performance, trivia tracking',
    openGraph: {
        title: 'Track Trivia Progress | Your Jeopardy Stats | trivrdy',
        description: 'Track your trivia progress and view detailed Jeopardy statistics. See your accuracy, points earned, category performance, and answer history.',
        url: 'https://trivrdy.com/stats',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Track Trivia Progress | Your Jeopardy Stats | trivrdy',
        description: 'Track your trivia progress and view detailed Jeopardy statistics. See your accuracy, points earned, and category performance.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/stats',
    },
}

export default function StatsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}

