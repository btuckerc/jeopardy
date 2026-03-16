import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/clerk-auth'
import { jsonResponse, serverErrorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 12
const EPISODE_VARIANT_MODE = 'episode'
const SUGGESTED_EPISODE_VARIANT_POOL_SIZE = 160

function clampLimit(value: string | null): number {
    const parsed = Number.parseInt(value || '', 10)
    if (Number.isNaN(parsed)) {
        return DEFAULT_LIMIT
    }

    return Math.min(Math.max(parsed, 1), MAX_LIMIT)
}

function normalizePage(value: string | null): number {
    const parsed = Number.parseInt(value || '', 10)
    if (Number.isNaN(parsed) || parsed < 1) {
        return 1
    }

    return parsed
}

function normalizeRound(value: string | null): 'SINGLE' | 'DOUBLE' | undefined {
    if (value === 'SINGLE' || value === 'DOUBLE') {
        return value
    }

    return undefined
}

function rankCategoryName(name: string, query: string): number {
    const normalizedName = name.toLowerCase()
    const normalizedQuery = query.toLowerCase()

    if (normalizedName === normalizedQuery) {
        return 0
    }

    if (normalizedName.startsWith(normalizedQuery)) {
        return 1
    }

    if (normalizedName.split(/[^a-z0-9]+/).some((token) => token.startsWith(normalizedQuery))) {
        return 2
    }

    return 3
}

function rankSuggestedEpisodeVariants(
    left: { answeredCount: number; questionCount: number; airDate: string | null; name: string },
    right: { answeredCount: number; questionCount: number; airDate: string | null; name: string },
): number {
    const leftSeen = left.answeredCount > 0 ? 1 : 0
    const rightSeen = right.answeredCount > 0 ? 1 : 0

    return leftSeen - rightSeen
        || left.answeredCount - right.answeredCount
        || right.questionCount - left.questionCount
        || (right.airDate || '').localeCompare(left.airDate || '')
        || left.name.localeCompare(right.name)
}

export async function GET(request: NextRequest) {
    try {
        const appUser = await getAppUser()
        const userId = appUser?.id

        const searchParams = request.nextUrl.searchParams
        const query = searchParams.get('q')?.trim() || ''
        const suggested = searchParams.get('suggested') === 'true'
        const page = normalizePage(searchParams.get('page'))
        const limit = clampLimit(searchParams.get('limit'))
        const minQuestions = Math.max(Number.parseInt(searchParams.get('minQuestions') || '0', 10) || 0, 0)
        const round = normalizeRound(searchParams.get('round'))
        const variantMode = searchParams.get('variantMode')
        const excludeIds = (searchParams.get('excludeIds') || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)

        if (!suggested && query.length < 2) {
            return jsonResponse([])
        }

        const user = userId ? await prisma.user.findUnique({
            where: { id: userId },
            select: {
                spoilerBlockDate: true,
                spoilerBlockEnabled: true,
            },
        }) : null

        if (variantMode === EPISODE_VARIANT_MODE) {
            const questionWhere: Prisma.QuestionWhereInput = {
                ...(round ? { round } : {}),
                ...(excludeIds.length > 0 ? { categoryId: { notIn: excludeIds } } : {}),
                airDate: {
                    not: null,
                    ...(user?.spoilerBlockEnabled ? { lt: user.spoilerBlockDate ?? undefined } : {}),
                },
                ...(query ? {
                    category: {
                        name: {
                            contains: query.replace(/\s+/g, ' ').trim(),
                            mode: 'insensitive',
                        },
                    },
                } : {}),
            }

            const grouped = await prisma.question.groupBy({
                by: ['categoryId', 'airDate', 'round'],
                where: questionWhere,
                _count: { id: true },
                orderBy: [
                    { _count: { id: 'desc' } },
                    { airDate: 'desc' },
                ],
                take: suggested
                    ? SUGGESTED_EPISODE_VARIANT_POOL_SIZE
                    : Math.max(limit * page * (query ? 8 : 4), limit),
            })

            const filtered = grouped.filter((row) => row._count.id >= minQuestions && row.airDate)
            if (filtered.length === 0) {
                return jsonResponse([])
            }

            const categories = await prisma.category.findMany({
                where: {
                    id: { in: filtered.map((row) => row.categoryId) },
                },
                select: {
                    id: true,
                    name: true,
                },
            })
            const categoryNameMap = new Map(categories.map((category) => [category.id, category.name]))
            const userProgressMap = userId
                ? new Map(
                    (await prisma.userProgress.findMany({
                        where: {
                            userId,
                            categoryId: { in: filtered.map((row) => row.categoryId) },
                        },
                        select: {
                            categoryId: true,
                            total: true,
                        },
                    })).map((progress) => [progress.categoryId, progress.total]),
                )
                : new Map<string, number>()

            const ranked = filtered
                .map((row) => ({
                    id: `${row.categoryId}:${row.round}:${row.airDate?.toISOString().slice(0, 10)}`,
                    categoryId: row.categoryId,
                    name: categoryNameMap.get(row.categoryId) || '',
                    airDate: row.airDate?.toISOString().slice(0, 10) || null,
                    round: row.round,
                    questionCount: row._count.id,
                    answeredCount: userProgressMap.get(row.categoryId) ?? 0,
                }))
                .filter((variant) => variant.name.length > 0 && variant.airDate)
                .sort((left, right) => {
                    if (suggested) {
                        return rankSuggestedEpisodeVariants(left, right)
                    }

                    if (!query) {
                        return right.questionCount - left.questionCount
                            || (right.airDate || '').localeCompare(left.airDate || '')
                            || left.name.localeCompare(right.name)
                    }

                    return rankCategoryName(left.name, query) - rankCategoryName(right.name, query)
                        || right.questionCount - left.questionCount
                        || (right.airDate || '').localeCompare(left.airDate || '')
                        || left.name.localeCompare(right.name)
                })

            const start = (page - 1) * limit
            return jsonResponse(
                ranked.slice(start, start + limit).map((variant) => ({
                    id: variant.id,
                    categoryId: variant.categoryId,
                    name: variant.name,
                    airDate: variant.airDate,
                    round: variant.round,
                    answeredCount: variant.answeredCount,
                    _count: {
                        questions: variant.questionCount,
                    },
                })),
            )
        }

        const questionWhere: Prisma.QuestionWhereInput = {
            ...(round ? { round } : {}),
            ...(excludeIds.length > 0 ? { categoryId: { notIn: excludeIds } } : {}),
            ...(user?.spoilerBlockEnabled ? {
                airDate: {
                    lt: user.spoilerBlockDate ?? undefined,
                },
            } : {}),
            ...(query ? {
                category: {
                    name: {
                        contains: query.replace(/\s+/g, ' ').trim(),
                        mode: 'insensitive',
                    },
                },
            } : {}),
        }

        const grouped = await prisma.question.groupBy({
            by: ['categoryId'],
            where: questionWhere,
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: Math.max(limit * page * (query ? 6 : 3), limit),
        })

        const filtered = grouped.filter((row) => row._count.id >= minQuestions)
        if (filtered.length === 0) {
            return jsonResponse([])
        }

        const categories = await prisma.category.findMany({
            where: {
                id: { in: filtered.map((row) => row.categoryId) },
            },
            select: {
                id: true,
                name: true,
            },
        })
        const categoryNameMap = new Map(categories.map((category) => [category.id, category.name]))

        const ranked = filtered
            .map((row) => ({
                id: row.categoryId,
                name: categoryNameMap.get(row.categoryId) || '',
                questionCount: row._count.id,
            }))
            .filter((category) => category.name.length > 0)
            .sort((left, right) => {
                if (!query) {
                    return right.questionCount - left.questionCount || left.name.localeCompare(right.name)
                }

                return rankCategoryName(left.name, query) - rankCategoryName(right.name, query)
                    || right.questionCount - left.questionCount
                    || left.name.localeCompare(right.name)
            })

        const start = (page - 1) * limit
        return jsonResponse(
            ranked.slice(start, start + limit).map((category) => ({
                id: category.id,
                name: category.name,
                _count: {
                    questions: category.questionCount,
                },
            })),
        )
    } catch (error) {
        return serverErrorResponse('Failed to search categories', error)
    }
}
