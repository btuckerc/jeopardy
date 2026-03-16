'use client'

import Link from 'next/link'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import toast from 'react-hot-toast'

type StudyBackLinkProps = {
    href: string
    children: ReactNode
    className?: string
}

type StudyBackButtonProps = {
    children: ReactNode
    className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

type StudyActionButtonProps = {
    children: ReactNode
    icon?: ReactNode
    className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

type StudyToggleProps = {
    label: ReactNode
    className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

const backControlClasses = 'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-4 py-2 text-sm font-bold text-blue-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800'
const actionButtonClasses = 'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:text-base'
const toggleClasses = 'inline-flex min-h-[52px] items-center gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-blue-300'

function ArrowLeftIcon() {
    return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
    )
}

function CloseIcon() {
    return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    )
}

export function StudyBackLink({ href, children, className = '' }: StudyBackLinkProps) {
    return (
        <Link href={href} className={`${backControlClasses} ${className}`.trim()}>
            <ArrowLeftIcon />
            <span>{children}</span>
        </Link>
    )
}

export function StudyBackButton({ children, className = '', ...props }: StudyBackButtonProps) {
    return (
        <button type="button" className={`${backControlClasses} ${className}`.trim()} {...props}>
            <ArrowLeftIcon />
            <span>{children}</span>
        </button>
    )
}

export function StudyActionButton({ children, icon, className = '', type = 'button', ...props }: StudyActionButtonProps) {
    return (
        <button type={type} className={`${actionButtonClasses} ${className}`.trim()} {...props}>
            {icon}
            <span>{children}</span>
        </button>
    )
}

export function StudyToggle({ label, className = '', ...props }: StudyToggleProps) {
    return (
        <label className={`${toggleClasses} ${className}`.trim()}>
            <span>{label}</span>
            <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                {...props}
            />
        </label>
    )
}

const PRACTICE_ANSWER_TIPS_TOAST_ID = 'practice-answer-tips'

export function showPracticeAnswerTipsToast() {
    toast.custom((t) => (
        <div className="w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-gray-900">Tips for answering</p>
                    <p className="mt-1 text-sm text-gray-600">Short answers are fine. The grader already normalizes common Jeopardy phrasing.</p>
                </div>
                <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Close answer tips"
                    onClick={() => toast.dismiss(t.id)}
                >
                    <CloseIcon />
                </button>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
                <li>You do not need to type What is or similar phrasing.</li>
                <li>Articles like a, an, and the are ignored.</li>
                <li>Punctuation and capitalization do not matter.</li>
                <li>Close answers may still be accepted.</li>
            </ul>
        </div>
    ), {
        id: PRACTICE_ANSWER_TIPS_TOAST_ID,
        duration: 12000,
        position: 'bottom-right'
    })
}
