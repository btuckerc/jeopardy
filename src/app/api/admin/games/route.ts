import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

// Helper function to check if user is admin
async function isAdmin(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
    })
    return user?.role === 'ADMIN'
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const season = searchParams.get('season')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Auth check
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin check
    const isUserAdmin = await isAdmin(session.user.id)
    if (!isUserAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build query filters
    const where: any = {}
    if (season) where.season = parseInt(season)
    if (startDate && endDate) {
        where.airDate = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        }
    }

    try {
        const games = await prisma.question.findMany({
            where,
            include: {
                category: true
            },
            orderBy: [
                { airDate: 'desc' },
                { season: 'desc' }
            ]
        })

        return NextResponse.json({ games })
    } catch (error) {
        console.error('Error fetching games:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    // Auth check
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin check
    const isUserAdmin = await isAdmin(session.user.id)
    if (!isUserAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const { action, data } = body

        switch (action) {
            case 'import':
                // Import new games
                await prisma.$transaction(async (tx) => {
                    for (const game of data) {
                        // Create or update categories
                        const category = await tx.category.upsert({
                            where: { name: game.category },
                            update: {},
                            create: { name: game.category }
                        })

                        // Create questions
                        await tx.question.create({
                            data: {
                                question: game.question,
                                answer: game.answer,
                                value: game.value,
                                categoryId: category.id,
                                difficulty: game.difficulty || 'MEDIUM',
                                airDate: game.airDate ? new Date(game.airDate) : null,
                                season: game.season,
                                episodeId: game.episodeId
                            }
                        })
                    }
                })
                return NextResponse.json({ message: 'Games imported successfully' })

            case 'delete':
                // Delete games by criteria
                const { season, startDate, endDate } = data
                const where: any = {}
                if (season) where.season = season
                if (startDate && endDate) {
                    where.airDate = {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }
                await prisma.question.deleteMany({ where })
                return NextResponse.json({ message: 'Games deleted successfully' })

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }
    } catch (error) {
        console.error('Error processing request:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
} 