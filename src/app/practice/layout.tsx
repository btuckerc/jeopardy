import { Metadata } from 'next'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
    title: 'Jeopardy Flashcards & Study Mode | Practice Trivia | trivrdy',
    description: 'Study Jeopardy questions with our comprehensive flashcard system. Practice by category, round, or challenge yourself with triple stumpers. Track your progress and improve your trivia knowledge.',
    keywords: 'jeopardy flashcards, study jeopardy, jeopardy practice, trivia flashcards, jeopardy study mode, practice trivia questions, jeopardy study tool',
    openGraph: {
        title: 'Jeopardy Flashcards & Study Mode | Practice Trivia | trivrdy',
        description: 'Study Jeopardy questions with our comprehensive flashcard system. Practice by category, round, or challenge yourself with triple stumpers.',
        url: 'https://trivrdy.com/practice',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Jeopardy Flashcards & Study Mode | trivrdy',
        description: 'Study Jeopardy questions with our comprehensive flashcard system. Practice by category, round, or challenge yourself with triple stumpers.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/practice',
    },
}

const learningResourceSchema = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: 'Jeopardy Study & Practice Mode',
    description: 'Study Jeopardy questions with our comprehensive flashcard system. Practice by category, round, or challenge yourself with triple stumpers.',
    url: 'https://trivrdy.com/practice',
    educationalUse: 'practice',
    learningResourceType: 'Flashcard',
    teaches: 'Trivia Knowledge',
    offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
    },
}

export default function PracticeLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <JsonLd data={learningResourceSchema} />
            {children}
        </>
    )
}

