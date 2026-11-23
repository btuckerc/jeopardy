import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
    buildMerkleTree,
    buildProvenanceReceipt,
    canonicalizeJson,
    verifyMerkleProof,
    verifyProvenanceReceipt,
} from './provenance'
import {
    hasAnswerLeak,
    hasSourceProseCopying,
    validateDraftClue,
    verifyWordplayRule,
} from './validators'
import { BlindOverlapGate } from './overlap-gate'
import { finalizeGenerationRun, verifyRunManifest } from './publisher'
import type { DraftClue, GeneratedCategoryPack, SourceFactRecord } from './types'

const SAMPLE_RECORD: SourceFactRecord = {
    sourceSystem: 'WIKIDATA_CC0',
    licenseSpdx: 'CC0-1.0',
    entityId: 'Q7186',
    sourceUrl: 'https://www.wikidata.org/wiki/Q7186',
    fetchedAt: '2026-11-22T17:00:00.000Z',
    label: 'Marie Curie',
    facts: {
        award: ['Nobel Prize in Physics', 'Nobel Prize in Chemistry'],
        country: 'Poland',
        discoveries: ['polonium', 'radium'],
    },
}

describe('Clean-Room Provenance & Merkle Verification', () => {
    it('produces deterministic canonical JSON regardless of key order', () => {
        const a = canonicalizeJson({ b: 2, a: { z: 9, y: 8 } })
        const b = canonicalizeJson({ a: { y: 8, z: 9 }, b: 2 })
        expect(a).toBe(b)
    })

    it('builds and verifies Merkle proofs and detects clue tampering', () => {
        const cluePayload = {
            categoryName: 'NOBEL PIONEERS',
            question: 'Born in Poland, this physicist and chemist discovered polonium and radium and won Nobel Prizes in two different sciences.',
            answer: 'Marie Curie',
            value: 400,
            round: 'SINGLE',
        }

        const r1 = buildProvenanceReceipt({
            engineVersion: '1.0.0',
            sourceBundle: [SAMPLE_RECORD],
            promptTemplateHash: 'prompt-hash-abc',
            modelId: 'test-model',
            samplingParams: { temperature: 0.5 },
            generatedAt: '2026-11-22T17:10:00.000Z',
            clue: cluePayload,
            overlapMaxScore: 0.12,
            overlapPassed: true,
            blindSolverPassed: true,
            qualityScore: 9.1,
        })

        const r2 = buildProvenanceReceipt({
            engineVersion: '1.0.0',
            sourceBundle: [SAMPLE_RECORD],
            promptTemplateHash: 'prompt-hash-abc',
            modelId: 'test-model',
            samplingParams: { temperature: 0.5 },
            generatedAt: '2026-11-22T17:11:00.000Z',
            clue: { ...cluePayload, value: 600 },
            overlapMaxScore: 0.08,
            overlapPassed: true,
            blindSolverPassed: true,
            qualityScore: 8.8,
        })

        const { root, proofs } = buildMerkleTree([r1.merkleLeafHash, r2.merkleLeafHash])
        r1.merkleProof = proofs[0]
        r2.merkleProof = proofs[1]

        expect(verifyMerkleProof(r1.merkleLeafHash, r1.merkleProof, root)).toBe(true)
        expect(verifyMerkleProof(r2.merkleLeafHash, r2.merkleProof, root)).toBe(true)

        const validReport = verifyProvenanceReceipt({
            clue: cluePayload,
            receipt: r1,
            runMerkleRoot: root,
        })
        expect(validReport.verified).toBe(true)
        expect(validReport.errors).toEqual([])

        // Tamper with clue wording -> verification MUST fail
        const tamperedReport = verifyProvenanceReceipt({
            clue: { ...cluePayload, question: cluePayload.question + ' Tampered.' },
            receipt: r1,
            runMerkleRoot: root,
        })
        expect(tamperedReport.verified).toBe(false)
        expect(tamperedReport.checks.outputHashValid).toBe(false)

        // Tamper with modelId or promptTemplateHash -> receiptHash MUST fail verification
        const tamperedModel = verifyProvenanceReceipt({
            clue: cluePayload,
            receipt: { ...r1, modelId: 'spoofed-model' },
            runMerkleRoot: root,
        })
        expect(tamperedModel.verified).toBe(false)
        expect(tamperedModel.checks.receiptHashValid).toBe(false)

        // Missing generatedAt or samplingParams -> MUST fail closed (never silently pass receiptHashValid)
        const missingFields = verifyProvenanceReceipt({
            clue: cluePayload,
            receipt: { ...r1, generatedAt: undefined, samplingParams: undefined },
            runMerkleRoot: root,
        })
        expect(missingFields.verified).toBe(false)
        expect(missingFields.checks.receiptHashValid).toBe(false)
    })
})

describe('Deterministic Quality, Wordplay & Anti-Leak Validators', () => {
    it('passes a crisp declarative clue grounded in the CC0 bundle', () => {
        const draft: DraftClue = {
            categoryName: 'NOBEL PIONEERS',
            question: 'Born in Poland, this trailblazer discovered both polonium and radium and earned Nobel Prizes in Physics and Chemistry.',
            answer: 'Marie Curie',
            acceptableAnswers: ['Curie'],
            suggestedDifficulty: 'EASY',
            suggestedSlot: 1,
            supportingEntityIds: ['Q7186'],
            supportingFactSummary: 'Poland, polonium, radium, Physics and Chemistry Nobels',
        }

        const res = validateDraftClue({
            draft,
            sourceRecords: [SAMPLE_RECORD],
            round: 'SINGLE',
        })
        expect(res.passed).toBe(true)
        expect(res.errors).toEqual([])
    })

    it('rejects answer leakage, possessive/root leaks, quiz-bot phrasing, and question-mark clues', () => {
        expect(hasAnswerLeak('Marie Curie won two Nobel prizes in science.', 'Marie Curie')).toBe(true)
        expect(hasAnswerLeak("André-Marie Ampère's name powers this SI unit of current.", 'ampere')).toBe(true)
        expect(hasAnswerLeak('Named for Edwin Jackson Kyle, this Texas venue seats over 100,000.', 'Kyle Field')).toBe(true)
        expect(hasAnswerLeak('Clark Gable plays a mutineer opposite Charles Laughton in this 1935 epic.', 'Mutiny on the Bounty')).toBe(true)
        expect(hasAnswerLeak('This Polish-born physicist won two Nobel prizes.', 'Marie Curie')).toBe(false)

        const badDraft: DraftClue = {
            categoryName: 'JEOPARDY SCIENCE',
            question: 'Who was the scientist who discovered polonium?',
            answer: 'Marie Curie',
            acceptableAnswers: [],
            suggestedDifficulty: 'EASY',
            suggestedSlot: 1,
            supportingEntityIds: ['Q999999'],
            supportingFactSummary: '',
        }

        const res = validateDraftClue({
            draft: badDraft,
            sourceRecords: [SAMPLE_RECORD],
            round: 'SINGLE',
        })
        expect(res.passed).toBe(false)
        expect(res.errors.length).toBeGreaterThanOrEqual(4)
    })

    it('mathematically verifies wordplay constraints', () => {
        expect(verifyWordplayRule('Ottawa', { type: 'DOUBLE_LETTER', value: '', description: 'double' })).toBe(true)
        expect(verifyWordplayRule('Paris', { type: 'DOUBLE_LETTER', value: '', description: 'double' })).toBe(false)
        expect(verifyWordplayRule('The Nile', { type: 'EXACT_LENGTH', value: 4, description: '4 letters' })).toBe(true)
        expect(verifyWordplayRule('Austria', { type: 'ENDS_WITH', value: 'ia', description: 'ends in ia' })).toBe(true)
        expect(verifyWordplayRule('Cobalt', { type: 'STARTS_WITH', value: 'c', description: 'starts with c' })).toBe(true)
    })

    it('blocks 5-gram verbatim copying from source prose', () => {
        const rec: SourceFactRecord = {
            ...SAMPLE_RECORD,
            facts: {
                description: 'pioneering physicist and chemist who conducted groundbreaking research on radioactivity',
            },
        }
        expect(
            hasSourceProseCopying(
                'This pioneering physicist and chemist who conducted research won two prizes.',
                [rec]
            )
        ).toBe(true)
    })
})

describe('Blind PASS/REJECT Overlap Quarantine Gate', () => {
    const gate = new BlindOverlapGate([
        {
            category: 'NOBEL PRIZE WINNERS',
            question: 'In 1903 she shared the Nobel Prize in Physics with her husband Pierre and Henri Becquerel',
            answer: 'Marie Curie',
        },
        {
            category: 'WORLD CAPITALS',
            question: 'This Canadian capital sits on the south bank of the river of the same name',
            answer: 'Ottawa',
        },
        {
            category: 'WORLD CAPITALS',
            question: 'The Danube splits this Hungarian capital into Buda and Pest',
            answer: 'Budapest',
        },
    ])

    it('rejects near-duplicate clues with the same answer and NEVER leaks reference text', () => {
        const res = gate.screenClue({
            categoryName: 'SCIENCE GREATS',
            question: 'In 1903 she shared the Nobel Prize in Physics with her husband Pierre and Henri Becquerel for radiation work.',
            answer: 'Marie Curie',
        })
        expect(res.passed).toBe(false)
        expect(res.reason).toBe('REJECT_SAME_ANSWER_HIGH_OVERLAP')
        // Verify return object has strictly blind fields
        expect(Object.keys(res).sort()).toEqual([
            'maxCategorySimilarity',
            'maxClueSimilarity',
            'passed',
            'reason',
        ])
    })

    it('passes genuinely original clues even when the factual answer matches a known entity', () => {
        const res = gate.screenClue({
            categoryName: 'ELEMENTS & DISCOVERERS',
            question: 'Naming element 84 after her native Poland, this Warsaw-born laureate remains the only person honored in both Physics and Chemistry.',
            answer: 'Marie Curie',
        })
        expect(res.passed).toBe(true)
    })

    it('rejects category selection & arrangement overlap', () => {
        const res = gate.screenCategorySet('WORLD CAPITALS', ['Ottawa', 'Budapest', 'Lima', 'Oslo', 'Cairo'])
        expect(res.passed).toBe(false)
        expect(res.reason).toBe('REJECT_CATEGORY_SELECTION_OVERLAP')
    })

    it('fails closed when screening corpus is empty', () => {
        const emptyGate = new BlindOverlapGate([])
        const clueRes = emptyGate.screenClue({
            categoryName: 'SCIENCE',
            question: 'Any original clue text here',
            answer: 'Marie Curie',
        })
        expect(clueRes.passed).toBe(false)
        expect(clueRes.reason).toBe('REJECT_EMPTY_CORPUS')

        const catRes = emptyGate.screenCategorySet('SCIENCE', ['Marie Curie'])
        expect(catRes.passed).toBe(false)
        expect(catRes.reason).toBe('REJECT_EMPTY_CORPUS')
    })

    it('rejects whitespace-only corpus rows and hashes full canonical clue text', () => {
        const blankGate = new BlindOverlapGate([
            { category: '   ', question: '   ', answer: '   ' },
            { category: 'CAT', question: '   ', answer: 'Answer' },
        ])
        expect(blankGate.indexedCount).toBe(0)
        expect(
            blankGate.screenClue({
                categoryName: 'SCIENCE',
                question: 'Any clue text here',
                answer: 'Marie Curie',
            }).reason
        ).toBe('REJECT_EMPTY_CORPUS')

        // Two distinct clues of identical length must produce different corpusHash digests
        const gateA = new BlindOverlapGate([
            { category: 'TEST', question: 'Alpha bravo charlie delta echo', answer: 'Answer' },
        ])
        const gateB = new BlindOverlapGate([
            { category: 'TEST', question: 'Hotel india juliet kiloo lima!', answer: 'Answer' },
        ])
        expect(gateA.corpusHash).not.toBe(gateB.corpusHash)
    })

    it('verifyRunManifest detects truncated clues and pack/clue category mismatches', () => {
        const clueBase = {
            categoryName: 'NOBEL PIONEERS',
            knowledgeCategory: 'SCIENCE_AND_NATURE' as const,
            round: 'SINGLE' as const,
            value: 200,
            difficulty: 'EASY' as const,
            question: 'This Warsaw-born physicist isolated polonium and radium.',
            answer: 'Marie Curie',
            acceptableAnswers: ['Curie'],
            archetype: 'CLASSIC_THEMATIC' as const,
        }
        const receipt1 = buildProvenanceReceipt({
            engineVersion: '1.0.0',
            sourceBundle: [SAMPLE_RECORD],
            promptTemplateHash: 'tmpl',
            modelId: 'test-model',
            samplingParams: { blindSolverPassed: true },
            generatedAt: '2026-11-23T00:00:00.000Z',
            clue: clueBase,
            overlapMaxScore: 0,
            overlapPassed: true,
            blindSolverPassed: true,
            qualityScore: 9,
        })
        const receipt2 = buildProvenanceReceipt({
            engineVersion: '1.0.0',
            sourceBundle: [SAMPLE_RECORD],
            promptTemplateHash: 'tmpl',
            modelId: 'test-model',
            samplingParams: { blindSolverPassed: true },
            generatedAt: '2026-11-23T00:00:00.000Z',
            clue: { ...clueBase, value: 400, question: 'She won both Physics and Chemistry Nobel Prizes.' },
            overlapMaxScore: 0,
            overlapPassed: true,
            blindSolverPassed: true,
            qualityScore: 9,
        })
        const pack: GeneratedCategoryPack = {
            categoryName: 'NOBEL PIONEERS',
            knowledgeCategory: 'SCIENCE_AND_NATURE',
            round: 'SINGLE',
            archetype: 'CLASSIC_THEMATIC',
            clues: [
                { ...clueBase, provenance: receipt1 },
                { ...clueBase, value: 400, question: 'She won both Physics and Chemistry Nobel Prizes.', provenance: receipt2 },
            ],
        }
        const { manifest } = finalizeGenerationRun({
            packs: [pack],
            modelId: 'test-model',
            packReleaseDate: '2026-11-23',
            referenceCorpus: [{ category: 'OTHER', question: 'Completely unrelated reference clue text', answer: 'Other' }],
        })
        expect(verifyRunManifest(manifest).valid).toBe(true)

        // Removing one clue must fail full Merkle root + count check
        const truncated = {
            ...manifest,
            categories: [{ ...manifest.categories[0], clues: [manifest.categories[0].clues[0]] }],
        }
        expect(verifyRunManifest(truncated).valid).toBe(false)

        // Changing parent categoryName without updating clue must fail
        const mismatchedCat = {
            ...manifest,
            categories: [{ ...manifest.categories[0], categoryName: 'RENAMED CATEGORY' }],
        }
        expect(verifyRunManifest(mismatchedCat).valid).toBe(false)

        // Duplicate receiptHash in manifest must fail
        const dupReceipt = {
            ...manifest,
            stats: { ...manifest.stats, totalPublished: 3 },
            categories: [{ ...manifest.categories[0], clues: [...manifest.categories[0].clues, manifest.categories[0].clues[1]] }],
        }
        expect(verifyRunManifest(dupReceipt).valid).toBe(false)
    })
})

describe('Clean-Room Air-Gap Structural Guarantee', () => {
    it('proves generator, harvesters, validators, provenance, and llm-client never import legacy data or overlap-gate', () => {
        const engineDir = path.resolve(__dirname)
        const airGappedFiles = [
            'types.ts',
            'provenance.ts',
            'validators.ts',
            'llm-client.ts',
            'harvesters.ts',
            'generator.ts',
        ]
        const forbiddenPatterns = [
            /jarchive/i,
            /overlap-gate/,
            /big_questions\.json/,
            /initial_questions\.json/,
            /jeopardy_questions\.json/,
            /LEGACY_JEOPARDY/,
        ]

        for (const file of airGappedFiles) {
            const raw = fs.readFileSync(path.join(engineDir, file), 'utf8')
            const codeWithoutComments = raw
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '')
            for (const pattern of forbiddenPatterns) {
                expect(codeWithoutComments, `${file} must not reference ${pattern} in code`).not.toMatch(pattern)
            }
        }
    })
})
