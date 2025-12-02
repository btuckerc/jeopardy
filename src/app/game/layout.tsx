import { Metadata } from 'next'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
    title: 'Play Jeopardy Online | Game Mode | trivrdy',
    description: 'Play authentic Jeopardy games online. Experience complete Jeopardy simulations with real categories, varying difficulty levels, and competitive scoring. Start a new game or resume where you left off.',
    keywords: 'play jeopardy online, jeopardy game, trivia game online, jeopardy simulator, online trivia game, jeopardy practice game',
    openGraph: {
        title: 'Play Jeopardy Online | Game Mode | trivrdy',
        description: 'Play authentic Jeopardy games online. Experience complete Jeopardy simulations with real categories, varying difficulty levels, and competitive scoring.',
        url: 'https://trivrdy.com/game',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Play Jeopardy Online | trivrdy',
        description: 'Play authentic Jeopardy games online. Experience complete Jeopardy simulations with real categories and competitive scoring.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/game',
    },
}

const gameSchema = {
    '@context': 'https://schema.org',
    '@type': 'Game',
    name: 'Jeopardy Game Mode',
    description: 'Play authentic Jeopardy games online. Experience complete Jeopardy simulations with real categories, varying difficulty levels, and competitive scoring.',
    url: 'https://trivrdy.com/game',
    applicationCategory: 'EducationalGame',
    gameItem: {
        '@type': 'Thing',
        name: 'Jeopardy Questions',
    },
    offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
    },
}

export default function GameLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <JsonLd data={gameSchema} />
            {children}
        </>
    )
}

