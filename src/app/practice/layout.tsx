import { Metadata } from 'next'
import { JsonLd } from '@/components/JsonLd'

export const metadata: Metadata = {
    title: 'Jeopardy Flashcards | Study Trivia Questions - trivrdy',
    description: 'Study Jeopardy with interactive flashcards. Practice by category, Jeopardy round, or challenge yourself with Triple Stumpers. Track progress and master trivia with 12,000+ authentic questions.',
    keywords: 'jeopardy flashcards, study jeopardy, jeopardy practice, trivia flashcards, jeopardy study tool, practice trivia questions, study trivia, jeopardy training',
    openGraph: {
        title: 'Jeopardy Flashcards | Study Trivia Questions - trivrdy',
        description: 'Study Jeopardy with interactive flashcards. Practice by category, round, or challenge yourself with Triple Stumpers.',
        url: 'https://trivrdy.com/practice',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Jeopardy Flashcards | Study Trivia Questions - trivrdy',
        description: 'Study Jeopardy with interactive flashcards. Practice by category, round, or challenge yourself with Triple Stumpers.',
    },
    alternates: {
        canonical: 'https://trivrdy.com/practice',
    },
}

const learningResourceSchema = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: 'Jeopardy Study Mode',
    description: 'Study Jeopardy questions with our comprehensive flashcard system. Study by category, round, or challenge yourself with triple stumpers.',
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
            name: 'Study Mode',
            item: 'https://trivrdy.com/practice',
        },
    ],
}

export default function PracticeLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <JsonLd data={learningResourceSchema} />
            <JsonLd data={breadcrumbSchema} />
            {children}
        </>
    )
}

