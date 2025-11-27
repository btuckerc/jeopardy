import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, badRequestResponse, unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const categoryName = searchParams.get('name')

    if (!categoryName) {
        return badRequestResponse('Category name is required')
    }

    try {
        const session = await auth()

        if (!session?.user?.id) {
            return unauthorizedResponse()
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
            return notFoundResponse('Category not found or has no questions')
        }

        return jsonResponse({
            categoryId: category.id,
            knowledgeCategory: category.questions[0].knowledgeCategory
        })
    } catch (error) {
        return serverErrorResponse('Failed to fetch category knowledge details', error)
    }
}
