import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id

        // Get user's spoiler settings if logged in
        const user = userId ? await prisma.user.findUnique({
            where: { id: userId },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true
            }
        }) : null

        // Get all categories with their question counts
        const categories = await prisma.category.findMany({
            where: user?.spoilerBlockEnabled ? {
                questions: {
                    some: {
                        airDate: {
                            lt: user.spoilerBlockDate ?? undefined
                        }
                    }
                }
            } : undefined,
            include: {
                _count: {
                    select: {
                        questions: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        })

        return NextResponse.json(categories)
    } catch (error) {
        console.error('Error fetching categories:', error)
        return NextResponse.json(
            { error: 'Failed to fetch categories' },
            { status: 500 }
        )
    }
} 