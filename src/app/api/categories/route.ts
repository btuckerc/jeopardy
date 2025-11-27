import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { jsonResponse, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const session = await auth()
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

        return jsonResponse(categories)
    } catch (error) {
        return serverErrorResponse('Failed to fetch categories', error)
    }
} 