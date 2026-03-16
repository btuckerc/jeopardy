import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Triple Stumper Questions | Hard Jeopardy Practice - trivrdy',
    description: 'Practice triple stumper Jeopardy questions that all three original contestants missed. Use harder clues to expose knowledge gaps and train at a higher difficulty level.',
    alternates: {
        canonical: 'https://trivrdy.com/practice/triple-stumpers',
    },
    openGraph: {
        title: 'Triple Stumper Questions | Hard Jeopardy Practice - trivrdy',
        description: 'Practice harder Jeopardy clues with triple stumpers that stumped every contestant on the original show.',
        url: 'https://trivrdy.com/practice/triple-stumpers',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Triple Stumper Questions | Hard Jeopardy Practice - trivrdy',
        description: 'Practice harder Jeopardy clues with triple stumpers that stumped every contestant on the original show.',
    },
}

export default function TripleStumpersLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
