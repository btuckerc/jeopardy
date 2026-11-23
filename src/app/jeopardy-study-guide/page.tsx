import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { PageHeader } from '@/components/PageHeader'

export const metadata: Metadata = {
    title: 'Jeopardy Study Guide | How to Practice Smarter - trivrdy',
    description: 'Use this Jeopardy study guide to build a repeatable practice routine with category review, round practice, daily challenges, and hard clue analysis.',
    alternates: {
        canonical: 'https://trivrdy.com/jeopardy-study-guide',
    },
    openGraph: {
        title: 'Jeopardy Study Guide | How to Practice Smarter - trivrdy',
        description: 'Build a repeatable Jeopardy study routine with category review, round practice, and hard clue analysis.',
        url: 'https://trivrdy.com/jeopardy-study-guide',
        type: 'article',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Jeopardy Study Guide | How to Practice Smarter - trivrdy',
        description: 'Build a repeatable Jeopardy study routine with category review, round practice, and hard clue analysis.',
    },
}

const studyPlan = [
    {
        title: 'Warm up with categories',
        body: 'Start with category practice so you can see where your recall is weakest and which recurring topics need more time.',
        href: '/practice/category',
    },
    {
        title: 'Train clue styles by round',
        body: 'Switch to round practice to get used to how clue wording and difficulty change across the board.',
        href: '/practice/round',
    },
    {
        title: 'Keep a daily habit',
        body: 'Use the daily challenge to maintain consistency and build category inference around Final Jeopardy style clues.',
        href: '/daily-challenge',
    },
    {
        title: 'Review difficult misses',
        body: 'Use triple stumpers to challenge yourself and create a high-signal review list from the hardest clues.',
        href: '/practice/triple-stumpers',
    },
]

export default function JeopardyStudyGuidePage() {
    return (
        <PageShell variant="narrow">
            <PageHeader
                kicker="Study Guide"
                title="A practical Jeopardy study guide"
                subtitle="Most people improve at Jeopardy by studying more consistently, not by collecting more random facts. Answer real clues, review misses quickly, and cycle between broad coverage and harder material."
            />

            <section className="space-y-5">
                {studyPlan.map((step, index) => (
                    <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
                                {index + 1}
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">{step.title}</h2>
                                <p className="mt-2 text-slate-700 leading-7">{step.body}</p>
                                <Link href={step.href} className="mt-3 inline-flex font-medium text-blue-700 hover:text-blue-900">
                                    Open this study mode
                                </Link>
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </PageShell>
    )
}
