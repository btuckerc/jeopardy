import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Daily Jeopardy Archive | Recent Final Jeopardy Practice - trivrdy',
    description: 'Browse recent daily challenge clues and catch up on missed Final Jeopardy style practice. Use the archive to keep your study streak moving.',
    alternates: {
        canonical: 'https://trivrdy.com/daily-challenge/archive',
    },
    openGraph: {
        title: 'Daily Jeopardy Archive | Recent Final Jeopardy Practice - trivrdy',
        description: 'Catch up on recent daily challenge clues and keep your Final Jeopardy practice streak going.',
        url: 'https://trivrdy.com/daily-challenge/archive',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Daily Jeopardy Archive | Recent Final Jeopardy Practice - trivrdy',
        description: 'Catch up on recent daily challenge clues and keep your Final Jeopardy practice streak going.',
    },
}

export default function DailyChallengeArchiveLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
