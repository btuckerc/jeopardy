'use server'

import { prisma } from '../lib/prisma'

export async function getCategories(userId?: string) {
    return await prisma.category.findMany({
        select: {
            id: true,
            name: true,
            _count: {
                select: { questions: true }
            },
            progress: userId ? {
                where: { userId },
                select: { correct: true, total: true }
            } : undefined
        }
    })
}

export async function getQuestion(categoryId: string, difficulty: string | null, userId?: string) {
    const difficultyFilter = difficulty && difficulty !== 'ALL'
        ? { difficulty: difficulty as 'EASY' | 'MEDIUM' | 'HARD' }
        : {}

    const userFilter = userId ? {
        NOT: {
            gameHistory: {
                some: {
                    userId,
                    correct: true
                }
            }
        }
    } : {}

    return await prisma.question.findFirst({
        where: {
            categoryId,
            ...difficultyFilter,
            ...userFilter
        },
        select: {
            id: true,
            question: true,
            answer: true,
            category: {
                select: { name: true }
            },
            difficulty: true
        },
        orderBy: [
            { gameHistory: { _count: 'asc' } }
        ]
    })
}

export async function saveAnswer(
    userId: string,
    questionId: string,
    categoryId: string,
    isCorrect: boolean
) {
    await prisma.$transaction([
        prisma.gameHistory.create({
            data: {
                userId,
                questionId,
                correct: isCorrect
            }
        }),
        prisma.userProgress.upsert({
            where: {
                userId_categoryId: {
                    userId,
                    categoryId
                }
            },
            update: {
                correct: { increment: isCorrect ? 1 : 0 },
                total: { increment: 1 }
            },
            create: {
                userId,
                categoryId,
                correct: isCorrect ? 1 : 0,
                total: 1
            }
        })
    ])
} 