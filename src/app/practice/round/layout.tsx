import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Practice Jeopardy by Round | Single, Double, Final - trivrdy',
    description: 'Train on Jeopardy clues by round. Practice Single Jeopardy, Double Jeopardy, and Final Jeopardy clue styles to improve pacing, inference, and endgame performance.',
    alternates: {
        canonical: 'https://trivrdy.com/practice/round',
    },
    openGraph: {
        title: 'Practice Jeopardy by Round | Single, Double, Final - trivrdy',
        description: 'Practice Single Jeopardy, Double Jeopardy, and Final Jeopardy clue styles in focused study sessions.',
        url: 'https://trivrdy.com/practice/round',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Practice Jeopardy by Round | Single, Double, Final - trivrdy',
        description: 'Practice Single Jeopardy, Double Jeopardy, and Final Jeopardy clue styles in focused study sessions.',
    },
}

export default function PracticeRoundLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
