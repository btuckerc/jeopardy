import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { KnowledgeCategory } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const knowledgeCategory = searchParams.get('category') as KnowledgeCategory | null

        // Get questions based on knowledge category
        const questions = await prisma.question.findMany({
            where: knowledgeCategory ? {
                knowledgeCategory
            } : {},
            include: {
                category: true
            }
        })

        if (!questions.length) {
            return new NextResponse('No questions found', { status: 404 })
        }

        // Randomly select one question
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)]

        return NextResponse.json({
            id: randomQuestion.id,
            question: randomQuestion.question,
            answer: randomQuestion.answer,
            value: randomQuestion.value,
            category: randomQuestion.knowledgeCategory,
            originalCategory: randomQuestion.category.name,
            knowledgeCategory: randomQuestion.knowledgeCategory
        })
    } catch (error) {
        console.error('Error shuffling questions:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
} 