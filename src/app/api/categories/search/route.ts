import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const appUser = await getAppUser()
        const userId = appUser?.id

        const searchParams = request.nextUrl.searchParams
        const query = searchParams.get('q')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = 10

        if (!query || query.length < 2) {
            return jsonResponse([])
        }

        // Get user's spoiler settings if logged in
        const user = userId ? await prisma.user.findUnique({
            where: { id: userId },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true
            }
        }) : null

        // Search categories with pagination and fuzzy matching
        const categories = await prisma.category.findMany({
            where: {
                OR: [
                    {
                        name: {
                            equals: query,
                            mode: 'insensitive'
                        }
                    },
                    {
                        name: {
                            startsWith: query,
                            mode: 'insensitive'
                        }
                    },
                    {
                        name: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    },
                    {
                        name: {
                            contains: query.replace(/\s+/g, ' ').trim(),
                            mode: 'insensitive'
                        }
                    }
                ],
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
                {
                    name: 'asc'
                }
            ],
            skip: (page - 1) * limit,
            take: limit
        })

        return jsonResponse(categories)
    } catch (error) {
        return serverErrorResponse('Failed to search categories', error)
    }
}
