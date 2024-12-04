import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const categoryName = searchParams.get('name')

    if (!categoryName) {
        return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    try {
        // Get the authenticated user
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get the category and its first question to determine the knowledge category
        const category = await prisma.category.findUnique({
            where: { name: categoryName },
            include: {
                questions: {
                    take: 1,
                    select: {
                        knowledgeCategory: true
                    }
                }
            }
        })

        if (!category || category.questions.length === 0) {
            return NextResponse.json({ error: 'Category not found or has no questions' }, { status: 404 })
        }

        return NextResponse.json({
            categoryId: category.id,
            knowledgeCategory: category.questions[0].knowledgeCategory
        })
    } catch (error) {
        console.error('Error fetching category knowledge details:', error)
        return NextResponse.json(
            { error: 'Failed to fetch category knowledge details' },
            { status: 500 }
        )
    }
} 