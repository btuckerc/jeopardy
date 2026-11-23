import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
    jsonResponse,
    requireAdmin,
    parseSearchParams,
    serverErrorResponse,
    knowledgeCategorySchema,
} from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const adminQuestionsParamsSchema = z.object({
    source: z.enum(['ORIGINAL_ENGINE', 'LEGACY_JEOPARDY', 'ALL']).optional().default('ORIGINAL_ENGINE'),
    publishStatus: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'ALL']).optional().default('ALL'),
    round: z.enum(['SINGLE', 'DOUBLE', 'FINAL']).optional(),
    knowledgeCategory: knowledgeCategorySchema.optional(),
    search: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
})

/**
 * GET /api/admin/questions
 *
 * Admin-only content & legacy-archive inspector.
 * Allows admins to browse, filter, and compare both ORIGINAL_ENGINE (with provenance)
 * and LEGACY_JEOPARDY questions, plus inspect recent QuestionGenerationRun manifests.
 */
export async function GET(request: Request) {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    try {
        const { searchParams } = new URL(request.url)
        const { data: params, error } = parseSearchParams(searchParams, adminQuestionsParamsSchema)
        if (error) return error

        const where: Prisma.QuestionWhereInput = {}
        if (params.source !== 'ALL') where.source = params.source
        if (params.publishStatus !== 'ALL') where.publishStatus = params.publishStatus
        if (params.round) where.round = params.round
        if (params.knowledgeCategory) where.knowledgeCategory = params.knowledgeCategory
        if (params.search) {
            where.OR = [
                { question: { contains: params.search, mode: 'insensitive' } },
                { answer: { contains: params.search, mode: 'insensitive' } },
                { category: { name: { contains: params.search, mode: 'insensitive' } } },
            ]
        }

        const [questions, total, sourceSummary, recentRuns] = await Promise.all([
            prisma.question.findMany({
                where,
                include: {
                    category: { select: { id: true, name: true, source: true } },
                    provenance: {
                        select: {
                            id: true,
                            licenseSpdx: true,
                            receiptHash: true,
                            sourceBundleHash: true,
                            overlapPassed: true,
                            overlapMaxScore: true,
                            blindSolverPassed: true,
                            qualityScore: true,
                            modelId: true,
                            verifiedAt: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (params.page - 1) * params.limit,
                take: params.limit,
            }),
            prisma.question.count({ where }),
            prisma.question.groupBy({
                by: ['source', 'publishStatus'],
                _count: { id: true },
            }),
            prisma.questionGenerationRun.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    engineVersion: true,
                    modelId: true,
                    merkleRoot: true,
                    packReleaseDate: true,
                    totalGenerated: true,
                    totalPassed: true,
                    totalRejectedOverlap: true,
                    createdAt: true,
                    publishedAt: true,
                },
            }),
        ])

        return jsonResponse({
            questions,
            pagination: {
                page: params.page,
                limit: params.limit,
                total,
                totalPages: Math.ceil(total / params.limit),
            },
            summary: sourceSummary.map((row) => ({
                source: row.source,
                publishStatus: row.publishStatus,
                count: row._count.id,
            })),
            recentGenerationRuns: recentRuns,
        })
    } catch (error) {
        return serverErrorResponse('Failed to load admin questions', error)
    }
}
