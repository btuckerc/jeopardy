import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'My Stats | Trivia Performance Tracking - trivrdy',
    description: 'Track your Jeopardy study progress, view your stats, accuracy, streaks, and performance by category. Monitor your trivia knowledge improvement over time.',
    keywords: 'trivrdy stats, jeopardy stats, trivia progress, study tracking, performance stats, quiz performance',
    openGraph: {
        title: 'My Stats | Trivia Performance Tracking - trivrdy',
        description: 'Track your Jeopardy study progress, view your stats, accuracy, streaks, and performance by category.',
        url: 'https://trivrdy.com/stats',
        type: 'website',
    },
    twitter: {
        card: 'summary',
        title: 'My Stats | Trivia Performance Tracking - trivrdy',
        description: 'Track your Jeopardy study progress, view your stats, accuracy, streaks, and performance by category.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/stats',
    },
    robots: {
        index: true,
        follow: true,
    },
}
