import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { PageHeader } from '@/components/PageHeader'

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
        <PageShell variant="narrow">
            <PageHeader
                kicker="Categories"
                title="Which Jeopardy categories should you study first?"
                subtitle="Start with categories you miss most often, then rotate between weak and strong topics so you build range without losing confidence."
            />

            <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900">Core categories worth reviewing every week</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {categoryList.map((category) => (
                        <div key={category} className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-slate-800">
                            <h3 className="font-semibold">{category}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                                Practice clues in {category.toLowerCase()} to improve retrieval speed and spot recurring themes that show up
                                in historical Jeopardy boards.
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900">A better way to study by topic</h2>
                <p className="mt-3 text-slate-700 leading-7">
                    Use category practice to answer a small block of clues, review misses immediately, then switch topics. That gives you more
                    retrieval practice than reading fact sheets because you are training recognition, phrasing, and answer format at the same time.
                </p>
                <Link href="/practice/category" className="mt-5 inline-flex font-medium text-blue-700 hover:text-blue-900">
                    Practice by category on trivrdy
                </Link>
            </section>
        </PageShell>
    )
}
