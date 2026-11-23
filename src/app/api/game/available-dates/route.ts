import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlayableQuestionWhere } from '@/lib/question-policy'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Get distinct pack release dates for published ORIGINAL_ENGINE questions
        const dates = await prisma.question.findMany({
            select: {
                airDate: true
            },
            where: {
                ...getPlayableQuestionWhere('ORIGINAL_ENGINE'),
                airDate: {
                    not: null
                }
            },
            distinct: ['airDate'],
            orderBy: {
                airDate: 'desc'
            }
        })

        return NextResponse.json({
            dates: dates
                .map((d: { airDate: Date | null }) => d.airDate?.toISOString().split('T')[0] ?? null)
                .filter(Boolean)
        })
    } catch (error) {
        console.error('Error fetching available dates:', error)
        return NextResponse.json({ error: 'Failed to fetch available dates' }, { status: 500 })
    }
}
