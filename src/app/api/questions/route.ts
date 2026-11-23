import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { startOfDay } from 'date-fns'
import { Prisma } from '@prisma/client'
import {
    jsonResponse,
    serverErrorResponse,
    parseSearchParams,
    getAuthenticatedUser,
    knowledgeCategorySchema,
    difficultySchema,
    paginationSchema
} from '@/lib/api-utils'
import {
    getPlayableQuestionWhere,
    resolveRequestedContentSource,
    shouldApplySpoilerFilter
} from '@/lib/question-policy'

export const dynamic = 'force-dynamic'

// Request validation schema
const questionsParamsSchema = z.object({
    category: z.string().optional(),
    knowledgeCategory: knowledgeCategorySchema.optional(),
    difficulty: difficultySchema.optional(),
    source: z.enum(['ORIGINAL_ENGINE', 'LEGACY_JEOPARDY']).optional(),
    airDateFrom: z.string().optional(),
    airDateTo: z.string().optional(),
    ...paginationSchema.shape
})

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const revealAnswers = searchParams.get('reveal') === 'true'
        const { data: params, error } = parseSearchParams(searchParams, questionsParamsSchema)

        if (error) return error

        // Resolve effective content source (LEGACY_JEOPARDY strictly restricted to admins)
        const user = await getAuthenticatedUser()
        const effectiveSource = resolveRequestedContentSource(params.source, user?.role === 'ADMIN')

        let spoilerBlockDate: Date | null = null
        let spoilerBlockEnabled = false

        if (user && shouldApplySpoilerFilter(effectiveSource)) {
            const userSettings = await prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    spoilerBlockDate: true,
                    spoilerBlockEnabled: true
                }
            })

            if (userSettings) {
                spoilerBlockDate = userSettings.spoilerBlockDate
                spoilerBlockEnabled = userSettings.spoilerBlockEnabled
            }
        }

        // Build where clause scoped to effectiveSource + PUBLISHED
        const where: Prisma.QuestionWhereInput = {
            ...getPlayableQuestionWhere(effectiveSource)
        }

        // Spoiler protection
        if (spoilerBlockEnabled) {
            where.airDate = {
                lt: spoilerBlockDate ?? startOfDay(new Date())
            }
        }

        // Category filter
        if (params.category) {
            where.category = { name: params.category }
        }

        // Knowledge category filter
        if (params.knowledgeCategory) {
            where.knowledgeCategory = params.knowledgeCategory
        }

        // Difficulty filter
        if (params.difficulty) {
            where.difficulty = params.difficulty
        }

        // Date range filter
        if (params.airDateFrom || params.airDateTo) {
            where.airDate = {
                ...(where.airDate as object || {}),
                ...(params.airDateFrom && { gte: new Date(params.airDateFrom) }),
                ...(params.airDateTo && { lte: new Date(params.airDateTo) })
            }
        }

        // Get questions with pagination
        const [questions, total] = await Promise.all([
            prisma.question.findMany({
                where,
                include: {
                    category: true
                },
                skip: (params.page - 1) * params.limit,
                take: params.limit,
                orderBy: {
                    airDate: 'desc'
                }
            }).then(rows => rows.map(row => ({
                ...row,
                answer: revealAnswers ? row.answer : null
            }))),
            prisma.question.count({ where })
        ])

        return jsonResponse({
            questions,
            pagination: {
                page: params.page,
                limit: params.limit,
                total,
                totalPages: Math.ceil(total / params.limit)
            }
        })
    } catch (error) {
        return serverErrorResponse('Error fetching questions', error)
    }
}
