'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { AppUser } from '@/lib/clerk-auth'

interface HelpClientProps {
    user: AppUser | null
    supportEmail: string | null
}

type IssueCategory = 'BUG' | 'CONTENT' | 'FEATURE_REQUEST' | 'ACCOUNT' | 'QUESTION' | 'OTHER'

export default function HelpClient({ user, supportEmail }: HelpClientProps) {
    const _router = useRouter()
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        subject: '',
        message: '',
        category: 'BUG' as IssueCategory,
        email: user?.email || ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!formData.subject.trim() || !formData.message.trim()) {
            toast.error('Please fill in all required fields')
            return
        }

        if (formData.message.length < 10) {
            toast.error('Message must be at least 10 characters')
            return
        }

        // If user is not authenticated, email is required
        if (!user && !formData.email.trim()) {
            toast.error('Email is required for unauthenticated users')
            return
        }

        setSubmitting(true)
        try {
            const payload: { subject: string; message: string; category: string; pageUrl?: string; email?: string } = {
                subject: formData.subject.trim(),
                message: formData.message.trim(),
                category: formData.category
            }

            if (!user && formData.email.trim()) {
                payload.email = formData.email.trim()
            }

            // Add current page URL as context
            if (typeof window !== 'undefined') {
                payload.pageUrl = window.location.href
            }

            const response = await fetch('/api/issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to submit issue')
            }

            toast.success('Thank you! Your message has been received.')
            setFormData({
                subject: '',
                message: '',
                category: 'BUG',
                email: user?.email || ''
            })
        } catch (error) {
            console.error('Error submitting issue:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to submit issue. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Contact Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email Support Card */}
                {supportEmail && (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Email Support</h2>
                        </div>
                        <p className="text-gray-600 mb-6">
                            For the fastest response, send me an email directly. I typically respond within 24-48 hours.
                        </p>
                        <a
                            href={`mailto:${supportEmail}?subject=trivrdy Support Request`}
                            className="btn-primary inline-flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Send Email
                        </a>
                    </div>
                )}

                {/* Report an Issue Card */}
                <div id="report" className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Report an Issue</h2>
                    </div>
                        <p className="text-gray-600 mb-6">
                            Found a bug or have a suggestion? Submit a report and I&apos;ll review it.
                        </p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                                Category
                            </label>
                            <select
                                id="category"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value as IssueCategory })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                required
                            >
                                <option value="BUG">Bug</option>
                                <option value="CONTENT">Content Issue</option>
                                <option value="FEATURE_REQUEST">Feature Request</option>
                                <option value="ACCOUNT">Account Issue</option>
                                <option value="QUESTION">Question</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                                Subject <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="subject"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                placeholder="Brief description of the issue"
                                maxLength={200}
                                required
                            />
                        </div>
                        {!user && (
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                                Message <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="message"
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                rows={6}
                                placeholder="Please provide as much detail as possible..."
                                maxLength={5000}
                                required
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                {formData.message.length} / 5000 characters
                            </p>
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn-primary w-full"
                        >
                            {submitting ? (
                                <>
                                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></span>
                                    Submitting...
                                </>
                            ) : (
                                'Submit Report'
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
                <div className="space-y-6 divide-y divide-gray-200">
                    <div className="pt-6 first:pt-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Who made this?</h3>
                        <p className="text-gray-600">
                            My name is Tucker. I&apos;m a senior software engineer. This is a personal project. I really like Jeopardy, 
                            wanted a place to study, thought I might make something out of it. I made this mostly for myself but can see 
                            the utility in sharing this with other people. If you want to reach out, hit that &quot;Email Support&quot; button - 
                            the email goes directly to me.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">What is trivrdy?</h3>
                        <p className="text-gray-600">
                            trivrdy is a free Jeopardy study tool that helps you study with authentic Jeopardy questions. 
                            With over 12,000 questions from real Jeopardy episodes, you can improve your trivia knowledge, 
                            track your progress, and compete on leaderboards.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">What is study mode?</h3>
                        <p className="text-gray-600">
                            Study mode is a focused way to practice specific topics. You can study by category, round, or challenge yourself with triple stumpers. 
                            Study mode games still count toward your stats and streaks, so you can track your progress while focusing on areas you want to improve.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Is this affiliated with Jeopardy?</h3>
                        <p className="text-gray-600">
                            No, trivrdy is not affiliated with, endorsed by, or connected to Jeopardy Productions or Sony Pictures Entertainment. 
                            This is an independent fan project created for educational purposes.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Do I need an account?</h3>
                        <p className="text-gray-600">
                            You can use trivrdy as a guest to study questions and play games, but signing in unlocks additional features 
                            including progress tracking, leaderboards, daily challenge history, achievements, and personalized stats. 
                            Creating an account is free and only takes a moment.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">How accurate are the answers?</h3>
                        <p className="text-gray-600">
                            Questions and answers are sourced from J! Archive, which contains data from historical Jeopardy episodes. 
                            While I strive for accuracy, edge cases or alternative acceptable answers may exist. If you believe an answer 
                            was incorrectly marked, you can dispute it using the dispute feature, or report it as a content issue.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">How do I report a bad ruling or wrong question?</h3>
                        <p className="text-gray-600">
                            If you believe an answer was incorrectly marked during gameplay or study mode, you can dispute it directly from 
                            the question result screen. For general content issues or questions about answer accuracy, you can use the 
                            &quot;Report an Issue&quot; form above and select &quot;Content Issue&quot; as the category.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">What data do you store?</h3>
                        <p className="text-gray-600">
                            I store your account information (email, display name), gameplay statistics, daily challenge results, 
                            and progress tracking data. This information is used to provide personalized features like leaderboards, 
                            achievements, and progress tracking. I do not share your data with third parties. For more details, 
                            please contact me using the email above.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">What are achievements?</h3>
                        <p className="text-gray-600">
                            Achievements are milestones you unlock as you play. They recognize everything from your first game to 
                            impressive streaks, high scores, and mastery of different knowledge categories. Some achievements are 
                            visible from the start, while others remain hidden until you unlock them. Check your achievements page 
                            to see your progress and discover new goals to work toward.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">What are the display name rules?</h3>
                        <p className="text-gray-600 mb-2">
                            Display names must follow these rules:
                        </p>
                        <ul className="text-gray-600 list-disc list-inside space-y-1 mb-2">
                            <li>Must be between 3 and 20 characters (after trimming spaces)</li>
                            <li>Must contain at least one letter (cannot be all numbers)</li>
                            <li>Can contain letters, numbers, spaces, and these characters: . _ -</li>
                            <li>Must be unique (case-insensitive, ignoring leading/trailing spaces)</li>
                            <li>Cannot contain profanity or offensive language (including workarounds like leetspeak or missing vowels)</li>
                            <li>Cannot impersonate official roles (e.g., &quot;admin&quot;, &quot;moderator&quot;, &quot;official&quot;, &quot;staff&quot;)</li>
                            <li>Cannot use reserved names like &quot;Jeopardy&quot; or &quot;system&quot;</li>
                        </ul>
                        <p className="text-gray-600">
                            Display names are case-insensitive for uniqueness checks, meaning &quot;Alice&quot;, &quot;alice&quot;, and &quot;ALICE&quot; 
                            are considered the same name. Leading and trailing spaces are automatically trimmed. The profanity filter 
                            detects common workarounds including character substitutions, leetspeak, missing vowels, and spacing tricks. 
                            Existing display names that don&apos;t meet these rules are grandfathered in, but any future changes must 
                            comply with all rules.
                        </p>
                    </div>
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Keyboard Shortcuts</h3>
                        <p className="text-gray-600 mb-3">
                            trivrdy supports keyboard shortcuts for quick navigation. Press <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">?</kbd> at any time to view all available shortcuts.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-600">
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono min-w-[2rem] text-center">G</kbd>
                                <span>Go to Game</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono min-w-[2rem] text-center">D</kbd>
                                <span>Go to Daily Challenge</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono min-w-[2rem] text-center">S</kbd>
                                <span>Go to Stats</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono min-w-[2rem] text-center">L</kbd>
                                <span>Go to Leaderboard</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono min-w-[2rem] text-center">P</kbd>
                                <span>Go to Practice</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono min-w-[2rem] text-center">H</kbd>
                                <span>Go to Home</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono min-w-[2rem] text-center">?</kbd>
                                <span>Show keyboard shortcuts</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono min-w-[2rem] text-center">Esc</kbd>
                                <span>Close modals/shortcuts</span>
                            </div>
                        </div>
                        <p className="text-gray-600 mt-3 text-sm">
                            Note: Shortcuts only work when you&apos;re not typing in an input field or textarea.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

