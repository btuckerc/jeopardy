import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id

        const searchParams = request.nextUrl.searchParams
        const query = searchParams.get('q')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = 10 // Limit results to prevent overwhelming the client

        if (!query || query.length < 2) {
            return NextResponse.json([])
        }

        // Get user's spoiler settings if logged in
        const user = userId ? await prisma.user.findUnique({
            where: { id: userId },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true
            }
        }) : null

        // Search categories with pagination
        const categories = await prisma.category.findMany({
            where: {
                name: {
                    contains: query,
                    mode: 'insensitive'
                },
                ...(user?.spoilerBlockEnabled ? {
                    questions: {
                        some: {
                            airDate: {
                                lt: user.spoilerBlockDate ?? undefined
                            }
                        }
                    }
                } : {})
            },
            include: {
                _count: {
                    select: {
                        questions: {
                            where: user?.spoilerBlockEnabled ? {
                                airDate: {
                                    lt: user.spoilerBlockDate ?? undefined
                                }
                            } : undefined
                        }
                    }
                }
            },
            orderBy: [
                { name: 'asc' }
            ],
            skip: (page - 1) * limit,
            take: limit
        })

        return NextResponse.json(categories)
    } catch (error) {
        console.error('Error searching categories:', error)
        return NextResponse.json(
            { error: 'Failed to search categories' },
            { status: 500 }
        )
    }
} 