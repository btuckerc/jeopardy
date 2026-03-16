import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Triple Stumper Questions | Hard Jeopardy Clues to Practice - trivrdy',
    description: 'Practice triple stumper questions from Jeopardy history. Use harder clues that every original contestant missed to reveal weak spots and improve advanced trivia recall.',
    alternates: {
        canonical: 'https://trivrdy.com/triple-stumper-questions',
    },
    openGraph: {
        title: 'Triple Stumper Questions | Hard Jeopardy Clues to Practice - trivrdy',
        description: 'Study hard Jeopardy clues that stumped every contestant and use them as advanced practice.',
        url: 'https://trivrdy.com/triple-stumper-questions',
        type: 'article',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Triple Stumper Questions | Hard Jeopardy Clues to Practice - trivrdy',
        description: 'Study hard Jeopardy clues that stumped every contestant and use them as advanced practice.',
    },
}

export default function TripleStumperQuestionsPage() {
    return (
        <div className="container mx-auto max-w-4xl px-4 py-10">
            <h1 className="text-4xl font-bold text-gray-900">Why triple stumper questions are useful for serious Jeopardy practice</h1>
            <p className="mt-4 text-lg leading-8 text-gray-700">
                Triple stumpers are clues that all three contestants missed on the original show. They are useful because they surface harder
                categories, more obscure facts, and clue wording that exposes weak pattern recognition. If regular practice has started to feel
                easy, triple stumpers give you better misses to learn from.
            </p>

            <section className="mt-10 grid gap-6 md:grid-cols-3">
                <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900">Harder clue pool</h2>
                    <p className="mt-3 text-gray-700 leading-7">
                        You spend less time on clues you already know and more time on the edges of your knowledge.
                    </p>
                </article>

                <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900">Better review material</h2>
                    <p className="mt-3 text-gray-700 leading-7">
                        A missed hard clue usually teaches more than another easy correct answer.
                    </p>
                </article>

                <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900">Category signal</h2>
                    <p className="mt-3 text-gray-700 leading-7">
                        Patterns in triple stumpers show which categories deserve deeper study sessions.
                    </p>
                </article>
            </section>

            <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-gray-900">When should you use them?</h2>
                <p className="mt-4 text-gray-700 leading-7">
                    Add triple stumpers after you already have a stable study routine. They work best as advanced reps layered on top of
                    category practice and daily challenge review, not as your only study mode.
                </p>
                <Link href="/practice/triple-stumpers" className="mt-5 inline-flex font-medium text-blue-700 hover:text-blue-900">
                    Practice triple stumpers on trivrdy
                </Link>
            </section>
        </div>
    )
}
