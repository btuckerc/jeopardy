import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonResponse, notFoundResponse, serverErrorResponse } from '@/lib/api-utils'
import { verifyProvenanceReceipt } from '@/lib/question-engine/provenance'
import type { MerkleProofStep, SourceFactRecord } from '@/lib/question-engine/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/questions/[questionId]/provenance
 *
 * Publicly verifiable clean-room provenance integrity endpoint for ORIGINAL_ENGINE questions.
 * Unconditionally recomputes sourceBundleHash, outputHash, receiptHash (binding all receipt
 * metadata), merkleLeafHash, and Merkle inclusion proof against the run Merkle root on demand.
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ questionId: string }> }
) {
    try {
        const { questionId } = await context.params
        if (!questionId) {
            return jsonResponse({ error: 'Missing questionId' }, 400)
        }

        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                category: { select: { name: true } },
                provenance: {
                    include: {
                        run: {
                            select: {
                                id: true,
                                engineVersion: true,
                                modelId: true,
                                merkleRoot: true,
                                screeningCorpusCount: true,
                                screeningCorpusHash: true,
                                packReleaseDate: true,
                                createdAt: true,
                                publishedAt: true,
                            },
                        },
                    },
                },
            },
        })

        if (!question || question.source !== 'ORIGINAL_ENGINE' || question.publishStatus !== 'PUBLISHED') {
            return notFoundResponse('Original question provenance not found')
        }

        if (!question.provenance) {
            return notFoundResponse('Provenance receipt not attached to this question')
        }

        const prov = question.provenance
        const sourceBundle = (Array.isArray(prov.sourceBundle) ? prov.sourceBundle : []) as unknown as SourceFactRecord[]
        const merkleProof = (Array.isArray(prov.merkleProof) ? prov.merkleProof : []) as unknown as MerkleProofStep[]
        const samplingParams =
            prov.samplingParams && typeof prov.samplingParams === 'object' && !Array.isArray(prov.samplingParams)
                ? (prov.samplingParams as Record<string, unknown>)
                : undefined

        const verification = verifyProvenanceReceipt({
            clue: {
                categoryName: question.category.name,
                question: question.question,
                answer: question.answer,
                value: question.value,
                round: question.round,
            },
            receipt: {
                engineVersion: prov.run.engineVersion,
                licenseSpdx: prov.licenseSpdx,
                sourceBundle,
                sourceBundleHash: prov.sourceBundleHash,
                promptTemplateHash: prov.promptTemplateHash,
                modelId: prov.modelId,
                samplingParams,
                generatedAt: prov.generatedAt || undefined,
                outputHash: prov.outputHash,
                receiptHash: prov.receiptHash,
                merkleLeafHash: prov.merkleLeafHash,
                merkleProof,
                overlapPassed: prov.overlapPassed,
            },
            runMerkleRoot: prov.run.merkleRoot,
        })

        // Cross-check displayed DB columns against hashed receipt metadata so column tampering fails verification
        if (
            typeof samplingParams?.blindSolverPassed === 'boolean' &&
            prov.blindSolverPassed !== samplingParams.blindSolverPassed
        ) {
            verification.verified = false
            verification.errors.push('Stored blindSolverPassed disagrees with hashed samplingParams.blindSolverPassed')
        }
        const expectedLicenses = Array.from(new Set(sourceBundle.map((s) => s.licenseSpdx))).sort().join(' AND ')
        if (expectedLicenses && prov.licenseSpdx !== expectedLicenses) {
            verification.verified = false
            verification.errors.push(`Stored licenseSpdx (${prov.licenseSpdx}) disagrees with verified sourceBundle licenses (${expectedLicenses})`)
        }

        return jsonResponse({
            questionId: question.id,
            source: question.source,
            category: question.category.name,
            round: question.round,
            value: question.value,
            licenseSpdx: prov.licenseSpdx,
            verified: verification.verified,
            verificationChecks: verification.checks,
            verificationErrors: verification.errors,
            provenance: {
                runId: prov.run.id,
                engineVersion: prov.run.engineVersion,
                modelId: prov.modelId,
                samplingParams: samplingParams ?? {},
                generatedAt: prov.generatedAt,
                packReleaseDate: prov.run.packReleaseDate,
                sourceBundleHash: prov.sourceBundleHash,
                promptTemplateHash: prov.promptTemplateHash,
                outputHash: prov.outputHash,
                receiptHash: prov.receiptHash,
                merkleLeafHash: prov.merkleLeafHash,
                merkleRoot: prov.run.merkleRoot,
                merkleProof,
                overlapPassed: prov.overlapPassed,
                overlapMaxScore: prov.overlapMaxScore,
                screeningCorpusCount: prov.run.screeningCorpusCount,
                screeningCorpusHash: prov.run.screeningCorpusHash,
                blindSolverPassed: prov.blindSolverPassed,
                qualityScore: prov.qualityScore,
                verifiedAt: prov.verifiedAt,
                sourceBundle,
                sources: sourceBundle.map((s) => ({
                    sourceSystem: s.sourceSystem,
                    licenseSpdx: s.licenseSpdx,
                    entityId: s.entityId,
                    sourceUrl: s.sourceUrl,
                    fetchedAt: s.fetchedAt,
                })),
            },
        })
    } catch (error) {
        return serverErrorResponse('Failed to verify question provenance', error)
    }
}
