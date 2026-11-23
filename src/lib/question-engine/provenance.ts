/**
 * Cryptographic Provenance & Merkle Tree Receipts
 *
 * Provides deterministic canonical JSON hashing, per-clue provenance receipts,
 * binary SHA-256 Merkle trees with inclusion proofs, and independent verification.
 *
 * Legal & technical honesty:
 * - This cryptographic receipt proves that a clue was generated from a specific,
 *   timestamped CC0/PD fact bundle, prompt template, and model run, and was not
 *   tampered with after generation.
 * - Combined with our separate blind PASS/REJECT overlap gate (overlap-gate.ts),
 *   it forms an auditable clean-room chain of custody.
 */

import crypto from 'crypto'
import type {
    AllowedLicenseSpdx,
    MerkleProofStep,
    ProvenanceReceipt,
    SourceFactRecord,
} from './types'

/**
 * Deterministic canonical JSON serialization with recursively sorted object keys.
 */
export function canonicalizeJson(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return '[' + value.map((item) => canonicalizeJson(item)).join(',') + ']'
    }
    const obj = value as Record<string, unknown>
    const sortedKeys = Object.keys(obj).sort()
    const pairs = sortedKeys
        .filter((key) => obj[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`)
    return '{' + pairs.join(',') + '}'
}

/**
 * SHA-256 hex digest of UTF-8 text.
 */
export function sha256Hex(input: string): string {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Derive the combined SPDX license string for a set of source records.
 */
export function computeCombinedLicenseSpdx(records: SourceFactRecord[]): AllowedLicenseSpdx {
    const licenses = new Set(records.map((r) => r.licenseSpdx))
    if (licenses.has('CC0-1.0') && licenses.has('Public-Domain')) {
        return 'CC0-1.0 AND Public-Domain'
    }
    if (licenses.has('Public-Domain') && !licenses.has('CC0-1.0')) {
        return 'Public-Domain'
    }
    return 'CC0-1.0'
}

/**
 * Compute deterministic output hash for a clue payload.
 */
export function computeClueOutputHash(clue: {
    categoryName: string
    question: string
    answer: string
    value: number
    round: string
}): string {
    return sha256Hex(
        canonicalizeJson({
            answer: clue.answer,
            categoryName: clue.categoryName,
            question: clue.question,
            round: clue.round,
            value: clue.value,
        })
    )
}

/**
 * Compute chained receipt hash binding inputs, prompt template, model, timestamp, and output.
 */
export function computeReceiptHash(params: {
    engineVersion: string
    sourceBundleHash: string
    promptTemplateHash: string
    modelId: string
    samplingParams: Record<string, unknown>
    generatedAt: string
    outputHash: string
}): string {
    return sha256Hex(
        canonicalizeJson({
            engineVersion: params.engineVersion,
            generatedAt: params.generatedAt,
            modelId: params.modelId,
            outputHash: params.outputHash,
            promptTemplateHash: params.promptTemplateHash,
            samplingParams: params.samplingParams,
            sourceBundleHash: params.sourceBundleHash,
        })
    )
}

/**
 * Compute Merkle leaf hash for a receipt hash (domain-separated with 0x00 prefix).
 */
export function computeMerkleLeafHash(receiptHash: string): string {
    return sha256Hex(`leaf:${receiptHash}`)
}

function hashMerkleNode(left: string, right: string): string {
    return sha256Hex(`node:${left}:${right}`)
}

/**
 * Build a binary SHA-256 Merkle tree and return the root plus per-index proofs.
 */
export function buildMerkleTree(leafHashes: string[]): {
    root: string
    proofs: MerkleProofStep[][]
} {
    if (leafHashes.length === 0) {
        return { root: sha256Hex('empty-merkle-tree'), proofs: [] }
    }

    const levels: string[][] = [leafHashes.slice()]
    while (levels[levels.length - 1].length > 1) {
        const current = levels[levels.length - 1]
        const next: string[] = []
        for (let i = 0; i < current.length; i += 2) {
            const left = current[i]
            const right = i + 1 < current.length ? current[i + 1] : current[i]
            next.push(hashMerkleNode(left, right))
        }
        levels.push(next)
    }

    const root = levels[levels.length - 1][0]
    const proofs: MerkleProofStep[][] = leafHashes.map((_, leafIndex) => {
        const proof: MerkleProofStep[] = []
        let idx = leafIndex
        for (let level = 0; level < levels.length - 1; level++) {
            const layer = levels[level]
            const isRightNode = idx % 2 === 1
            const siblingIdx = isRightNode ? idx - 1 : Math.min(idx + 1, layer.length - 1)
            proof.push({
                position: isRightNode ? 'left' : 'right',
                hash: layer[siblingIdx],
            })
            idx = Math.floor(idx / 2)
        }
        return proof
    })

    return { root, proofs }
}

/**
 * Verify a Merkle inclusion proof against a claimed Merkle root.
 */
export function verifyMerkleProof(
    leafHash: string,
    proof: MerkleProofStep[],
    expectedRoot: string
): boolean {
    let current = leafHash
    for (const step of proof) {
        current =
            step.position === 'left'
                ? hashMerkleNode(step.hash, current)
                : hashMerkleNode(current, step.hash)
    }
    return current === expectedRoot
}

/**
 * Build an unsigned provenance receipt (before Merkle proofs are attached at run finalization).
 */
export function buildProvenanceReceipt(params: {
    engineVersion: string
    sourceBundle: SourceFactRecord[]
    promptTemplateHash: string
    modelId: string
    samplingParams: Record<string, unknown>
    generatedAt: string
    clue: {
        categoryName: string
        question: string
        answer: string
        value: number
        round: string
    }
    overlapMaxScore: number | null
    overlapPassed: boolean
    blindSolverPassed: boolean
    qualityScore: number | null
}): ProvenanceReceipt {
    const sourceBundleHash = sha256Hex(canonicalizeJson(params.sourceBundle))
    const outputHash = computeClueOutputHash(params.clue)
    const receiptHash = computeReceiptHash({
        engineVersion: params.engineVersion,
        sourceBundleHash,
        promptTemplateHash: params.promptTemplateHash,
        modelId: params.modelId,
        samplingParams: params.samplingParams,
        generatedAt: params.generatedAt,
        outputHash,
    })
    const merkleLeafHash = computeMerkleLeafHash(receiptHash)

    return {
        engineVersion: params.engineVersion,
        licenseSpdx: computeCombinedLicenseSpdx(params.sourceBundle),
        sourceBundle: params.sourceBundle,
        sourceBundleHash,
        promptTemplateHash: params.promptTemplateHash,
        modelId: params.modelId,
        samplingParams: params.samplingParams,
        generatedAt: params.generatedAt,
        outputHash,
        receiptHash,
        merkleLeafHash,
        merkleProof: [],
        overlapMaxScore: params.overlapMaxScore,
        overlapPassed: params.overlapPassed,
        blindSolverPassed: params.blindSolverPassed,
        qualityScore: params.qualityScore,
    }
}

export interface ProvenanceVerificationReport {
    verified: boolean
    checks: {
        hasAllowedLicenseOnly: boolean
        sourceBundleHashValid: boolean
        outputHashValid: boolean
        receiptHashValid: boolean
        merkleLeafValid: boolean
        merkleProofValid: boolean
        overlapGatePassed: boolean
    }
    errors: string[]
}

/**
 * Independently verify all cryptographic hashes, Merkle proof, and license invariants
 * for a stored clue + provenance receipt.
 */
export function verifyProvenanceReceipt(params: {
    clue: {
        categoryName: string
        question: string
        answer: string
        value: number
        round: string
    }
    receipt: {
        engineVersion: string
        licenseSpdx: string
        sourceBundle: SourceFactRecord[]
        sourceBundleHash: string
        promptTemplateHash: string
        modelId: string
        samplingParams?: Record<string, unknown>
        generatedAt?: string
        outputHash: string
        receiptHash: string
        merkleLeafHash: string
        merkleProof: MerkleProofStep[]
        overlapPassed: boolean
    }
    runMerkleRoot: string
}): ProvenanceVerificationReport {
    const errors: string[] = []
    const { clue, receipt, runMerkleRoot } = params

    const allowedLicenses = new Set(['CC0-1.0', 'Public-Domain'])
    const hasAllowedLicenseOnly =
        Array.isArray(receipt.sourceBundle) &&
        receipt.sourceBundle.length > 0 &&
        receipt.sourceBundle.every((r) => allowedLicenses.has(r.licenseSpdx))
    if (!hasAllowedLicenseOnly) {
        errors.push('Source bundle is empty or contains a non-CC0/non-PD license')
    }

    const expectedSourceHash = sha256Hex(canonicalizeJson(receipt.sourceBundle))
    const sourceBundleHashValid = expectedSourceHash === receipt.sourceBundleHash
    if (!sourceBundleHashValid) {
        errors.push('sourceBundleHash mismatch')
    }

    const expectedOutputHash = computeClueOutputHash(clue)
    const outputHashValid = expectedOutputHash === receipt.outputHash
    if (!outputHashValid) {
        errors.push('outputHash mismatch (clue text or answer was altered after generation)')
    }

    let receiptHashValid = false
    if (
        typeof receipt.generatedAt === 'string' &&
        receipt.generatedAt.length > 0 &&
        receipt.samplingParams &&
        typeof receipt.samplingParams === 'object'
    ) {
        const expectedReceiptHash = computeReceiptHash({
            engineVersion: receipt.engineVersion,
            sourceBundleHash: receipt.sourceBundleHash,
            promptTemplateHash: receipt.promptTemplateHash,
            modelId: receipt.modelId,
            samplingParams: receipt.samplingParams,
            generatedAt: receipt.generatedAt,
            outputHash: receipt.outputHash,
        })
        receiptHashValid = expectedReceiptHash === receipt.receiptHash
        if (!receiptHashValid) {
            errors.push('receiptHash mismatch')
        }
    } else {
        errors.push('receiptHash cannot be verified: missing generatedAt or samplingParams')
    }

    const expectedLeafHash = computeMerkleLeafHash(receipt.receiptHash)
    const merkleLeafValid = expectedLeafHash === receipt.merkleLeafHash
    if (!merkleLeafValid) {
        errors.push('merkleLeafHash mismatch')
    }

    const merkleProofValid = verifyMerkleProof(
        receipt.merkleLeafHash,
        receipt.merkleProof,
        runMerkleRoot
    )
    if (!merkleProofValid) {
        errors.push('merkleProof failed verification against run merkleRoot')
    }

    const overlapGatePassed = Boolean(receipt.overlapPassed)
    if (!overlapGatePassed) {
        errors.push('overlap gate did not pass')
    }

    return {
        verified:
            hasAllowedLicenseOnly &&
            sourceBundleHashValid &&
            outputHashValid &&
            receiptHashValid &&
            merkleLeafValid &&
            merkleProofValid &&
            overlapGatePassed,
        checks: {
            hasAllowedLicenseOnly,
            sourceBundleHashValid,
            outputHashValid,
            receiptHashValid,
            merkleLeafValid,
            merkleProofValid,
            overlapGatePassed,
        },
        errors,
    }
}
