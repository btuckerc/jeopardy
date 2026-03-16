import Link from 'next/link'
import PracticeRecommendationsPanel from './PracticeRecommendationsPanel'
import BackToTopButton from '@/components/BackToTopButton'

const practiceFaqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'How should I practice Jeopardy questions on trivrdy?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Start with broad category practice, then switch to round-specific sessions and triple stumpers. The goal is to mix recall, pattern recognition, and weaker categories instead of repeating only favorite topics.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can I practice Final Jeopardy style clues?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. Use the daily challenge for a fresh Final Jeopardy style clue each day, or use study by round to focus on Final Jeopardy clues when you want concentrated practice.',
            },
        },
        {
            '@type': 'Question',
            name: 'What are triple stumpers?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Triple stumpers are clues that none of the original contestants answered correctly. They are useful for advanced training because they surface harder clues and reveal gaps in category knowledge.',
            },
        },
    ],
}

export default function PracticeLanding() {
    return (
        <>
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Study Mode</h1>
                <p className="text-gray-600 mb-8 text-lg">
                    Practice real Jeopardy clues by category, by round, or with the hardest triple stumpers. Study mode games still count toward your stats and streaks.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl">
                    {/* Study by Category Card */}
                    <Link
                        href="/practice/category"
                        className="group p-8 bg-blue-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-white"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold">Study by Category</h2>
                        </div>
                        <p className="text-white/90 text-lg">
                            Study questions organized by knowledge categories like Geography, Entertainment, Arts & Literature, and more.
                        </p>
                        <div className="mt-6 flex items-center text-white/80 group-hover:text-white transition-colors">
                            <span className="font-medium">Get Started</span>
                            <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </Link>

                    {/* Study by Round Card */}
                    <Link
                        href="/practice/round"
                        className="group p-8 bg-purple-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-white"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold">Study by Round</h2>
                        </div>
                        <p className="text-white/90 text-lg">
                            Study questions from specific Jeopardy rounds: Single Jeopardy, Double Jeopardy, or Final Jeopardy.
                        </p>
                        <div className="mt-6 flex items-center text-white/80 group-hover:text-white transition-colors">
                            <span className="font-medium">Get Started</span>
                            <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </Link>

                    {/* Triple Stumpers Card */}
                    <Link
                        href="/practice/triple-stumpers"
                        className="group p-8 bg-yellow-500 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-white"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548-.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold">Triple Stumpers</h2>
                        </div>
                        <p className="text-white/90 text-lg">
                            Challenge yourself with questions that stumped all three original Jeopardy! contestants.
                        </p>
                        <div className="mt-6 flex items-center text-white/80 group-hover:text-white transition-colors">
                            <span className="font-medium">Get Started</span>
                            <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </Link>
                </div>

            <div className="mt-10 max-w-6xl">
                <PracticeRecommendationsPanel />
            </div>

            <section className="mt-16 max-w-5xl space-y-8">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8">
                    <h2 className="text-2xl font-bold text-gray-900">How to use trivrdy as a Jeopardy study tool</h2>
                    <p className="mt-4 text-gray-700 leading-7">
                        The best Jeopardy practice mixes repetition with variation. Start with broad category study to spot weak areas,
                        switch to round-based practice when you want to train clue style and dollar-value pacing, and use triple stumpers
                        when you want hard questions that expose gaps quickly.
                    </p>
                    <p className="mt-4 text-gray-700 leading-7">
                        trivrdy is built around authentic historical clues, so you can use it like flashcards, like a trivia workout, or
                        like a lightweight study guide before a quiz bowl event, pub trivia night, or your next Jeopardy audition practice session.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-gray-900">Category practice</h2>
                        <p className="mt-3 text-gray-700 leading-7">
                            Review recurring topics like history, geography, science, literature, and pop culture with focused clue sets.
                        </p>
                        <Link href="/jeopardy-categories" className="mt-4 inline-flex font-medium text-blue-700 hover:text-blue-900">
                            Explore category strategy
                        </Link>
                    </article>

                    <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-gray-900">Final Jeopardy prep</h2>
                        <p className="mt-3 text-gray-700 leading-7">
                            Train longer clue parsing, category inference, and endgame recall with Final Jeopardy style practice.
                        </p>
                        <Link href="/final-jeopardy-practice" className="mt-4 inline-flex font-medium text-blue-700 hover:text-blue-900">
                            Learn Final Jeopardy practice
                        </Link>
                    </article>

                    <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-gray-900">Advanced difficulty</h2>
                        <p className="mt-3 text-gray-700 leading-7">
                            Triple stumpers are useful when you have plateaued on easier clues and need harder misses to study from.
                        </p>
                        <Link href="/triple-stumper-questions" className="mt-4 inline-flex font-medium text-blue-700 hover:text-blue-900">
                            See why triple stumpers matter
                        </Link>
                    </article>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-900">Frequently asked questions about Jeopardy practice</h2>

                    <div className="mt-6 space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">What is the best way to study for Jeopardy?</h3>
                            <p className="mt-2 text-gray-700 leading-7">
                                Build a repeatable system: practice broad categories, review misses, rotate into harder clue sets, and keep
                                track of where your accuracy drops. Consistency matters more than marathon sessions.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Should I practice by category or by round?</h3>
                            <p className="mt-2 text-gray-700 leading-7">
                                Do both. Category practice is better for knowledge gaps. Round practice is better for pacing, clue variety,
                                and getting used to the different feel of Single Jeopardy, Double Jeopardy, and Final Jeopardy.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">How often should I review triple stumpers?</h3>
                            <p className="mt-2 text-gray-700 leading-7">
                                Use them after you have a baseline. They are most useful when you already answer a fair amount correctly and
                                need harder material to keep improving.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
                    <h2 className="text-2xl font-bold text-gray-900">More Jeopardy study resources on trivrdy</h2>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
                        <Link href="/jeopardy-study-guide" className="rounded-full bg-white px-4 py-2 text-blue-700 shadow-sm ring-1 ring-blue-100 hover:text-blue-900">
                            Jeopardy study guide
                        </Link>
                        <Link href="/daily-challenge" className="rounded-full bg-white px-4 py-2 text-blue-700 shadow-sm ring-1 ring-blue-100 hover:text-blue-900">
                            Daily challenge
                        </Link>
                        <Link href="/practice/category" className="rounded-full bg-white px-4 py-2 text-blue-700 shadow-sm ring-1 ring-blue-100 hover:text-blue-900">
                            Study by category
                        </Link>
                        <Link href="/practice/round" className="rounded-full bg-white px-4 py-2 text-blue-700 shadow-sm ring-1 ring-blue-100 hover:text-blue-900">
                            Study by round
                        </Link>
                    </div>
                </div>
            </section>
        </div>
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(practiceFaqSchema) }}
        />
        <BackToTopButton />
        </>
    )
}
