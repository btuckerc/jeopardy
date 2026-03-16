import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Study Jeopardy Categories | Trivia by Topic - trivrdy',
    description: 'Practice Jeopardy questions by category, including history, science, geography, literature, pop culture, and more. Use category practice to find weak spots and improve recall.',
    alternates: {
        canonical: 'https://trivrdy.com/practice/category',
    },
    openGraph: {
        title: 'Study Jeopardy Categories | Trivia by Topic - trivrdy',
        description: 'Practice Jeopardy questions by category to improve recall across your weakest topics.',
        url: 'https://trivrdy.com/practice/category',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Study Jeopardy Categories | Trivia by Topic - trivrdy',
        description: 'Practice Jeopardy questions by category to improve recall across your weakest topics.',
    },
}

export default function PracticeCategoryLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
