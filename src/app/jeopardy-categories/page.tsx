import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Jeopardy Categories to Study | History, Science, Geography, More - trivrdy',
    description: 'Study common Jeopardy categories and practice real clues by topic. Use category practice to improve weak areas like history, science, literature, geography, and entertainment.',
    alternates: {
        canonical: 'https://trivrdy.com/jeopardy-categories',
    },
    openGraph: {
        title: 'Jeopardy Categories to Study | History, Science, Geography, More - trivrdy',
        description: 'Practice real Jeopardy clues by category and build a smarter topic-by-topic study plan.',
        url: 'https://trivrdy.com/jeopardy-categories',
        type: 'article',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Jeopardy Categories to Study | History, Science, Geography, More - trivrdy',
        description: 'Practice real Jeopardy clues by category and build a smarter topic-by-topic study plan.',
    },
}

const categoryList = [
    'History',
    'Science',
    'Geography',
    'Literature',
    'Arts',
    'Entertainment',
]

export default function JeopardyCategoriesPage() {
    return (
        <div className="container mx-auto max-w-4xl px-4 py-10">
            <h1 className="text-4xl font-bold text-gray-900">Which Jeopardy categories should you study first?</h1>
            <p className="mt-4 text-lg leading-8 text-gray-700">
                The best category plan is not to memorize everything at once. Start with categories you miss most often, then rotate between
                weak and strong topics so you build range without losing confidence. trivrdy lets you practice authentic clues by category so
                you can study with real question styles instead of generic trivia lists.
            </p>

            <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-gray-900">Core categories worth reviewing every week</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {categoryList.map((category) => (
                        <div key={category} className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-gray-800">
                            <h3 className="font-semibold">{category}</h3>
                            <p className="mt-2 text-sm leading-6 text-gray-700">
                                Practice clues in {category.toLowerCase()} to improve retrieval speed and spot recurring themes that show up
                                in historical Jeopardy boards.
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-gray-900">A better way to study by topic</h2>
                <p className="mt-4 text-gray-700 leading-7">
                    Use category practice to answer a small block of clues, review misses immediately, then switch topics. That gives you more
                    retrieval practice than reading fact sheets because you are training recognition, phrasing, and answer format at the same time.
                </p>
                <Link href="/practice/category" className="mt-5 inline-flex font-medium text-blue-700 hover:text-blue-900">
                    Practice by category on trivrdy
                </Link>
            </section>
        </div>
    )
}
