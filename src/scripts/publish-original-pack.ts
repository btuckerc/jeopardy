/**
 * CLI: Verify and Publish a Saved Clean-Room Original Pack Manifest into PostgreSQL
 *
 * Usage:
 *   npx ts-node --project tsconfig.json src/scripts/publish-original-pack.ts data/original-packs/pack.json
 */

import 'dotenv/config'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import {
    publishRunManifestToDatabase,
    verifyRunManifest,
} from '../lib/question-engine/publisher'
import type { GenerationRunManifest } from '../lib/question-engine/types'

async function main() {
    const filePath = process.argv[2]
    if (!filePath || !fs.existsSync(filePath)) {
        console.error('Usage: ts-node src/scripts/publish-original-pack.ts <path-to-manifest.json>')
        process.exit(1)
    }

    const manifest = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GenerationRunManifest
    const check = verifyRunManifest(manifest)
    if (!check.valid) {
        console.error('Manifest cryptographic verification FAILED:', check.errors)
        process.exit(1)
    }

    console.log(`✓ Verified ${check.verifiedClues} clues against Merkle root ${manifest.merkleRoot}`)

    const prisma = new PrismaClient()
    try {
        const result = await publishRunManifestToDatabase(prisma, manifest)
        console.log('✓ Published to PostgreSQL:', JSON.stringify(result, null, 2))
    } finally {
        await prisma.$disconnect()
    }
}

main().catch((err) => {
    console.error('Publish failed:', err)
    process.exit(1)
})
