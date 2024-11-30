'use server'

import { prisma } from '../lib/prisma'

export async function getCategories(userId?: string) {
    try {
        const categories = await prisma.category.findMany({
            include: {
                questions: {
                    select: {
                        id: true,
                        question: true,
                        answer: true,
                        value: true,
                        category: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        })

        return categories.map(category => ({
            id: category.id,
            name: category.name,
            questions: category.questions.map(q => ({
                id: q.id,
                question: q.question,
                answer: q.answer,
                value: q.value || 200,
                categoryName: category.name,
                originalCategory: q.category.name
            }))
        }))
    } catch (error) {
        console.error('Error fetching categories:', error)
        throw error
    }
}

export async function saveAnswer(
    userId: string,
    questionId: string,
    categoryId: string,
    isCorrect: boolean
) {
    if (!userId || !questionId || !categoryId) return

    try {
        await prisma.$transaction(async (tx) => {
            // Ensure user exists
            const user = await tx.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: '', // We'll update this later if needed
                }
            })

            // Create game history entry
            await tx.gameHistory.create({
                data: {
                    userId: user.id,
                    questionId,
                    correct: isCorrect,
                    points: isCorrect ? 200 : 0 // Default value for practice mode
                }
            })

            // Update or create user progress
            await tx.userProgress.upsert({
                where: {
                    userId_categoryId: {
                        userId: user.id,
                        categoryId
                    }
                },
                update: {
                    correct: { increment: isCorrect ? 1 : 0 },
                    total: { increment: 1 },
                    points: { increment: isCorrect ? 200 : 0 }
                },
                create: {
                    id: crypto.randomUUID(),
                    userId: user.id,
                    categoryId,
                    correct: isCorrect ? 1 : 0,
                    total: 1,
                    points: isCorrect ? 200 : 0
                }
            })
        })
    } catch (error) {
        console.error('Error saving answer:', error)
        throw error
    }
} 