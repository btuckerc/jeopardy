/**
 * Script to update wasTripleStumper field by re-scraping J-Archive
 * Run with: npm run db:update-triple-stumpers
 */

import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

// Rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function cleanText(text: string): string {
    return text
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
}

async function scrapeEpisodeTripleStumpers(episodeId: string): Promise<Map<string, boolean>> {
    const tripleStumperMap = new Map<string, boolean>()
    
    try {
        const url = `https://j-archive.com/showgame.php?game_id=${episodeId}`
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; JeopardyBot/1.0)'
            },
            timeout: 10000
        })
        
        const $ = cheerio.load(response.data)
        
        // Find all clues
        $('.clue').each((_, clueElement) => {
            const $clue = $(clueElement)
            const $clueText = $clue.find('.clue_text[id^="clue_"]').first()
            const question = cleanText($clueText.text())
            
            if (!question) return
            
            // Check for triple stumper in the response
            const $responseText = $clue.find('.clue_text[id$="_r"]')
            const isTripleStumper = $responseText.text().includes('Triple Stumper')
            
            if (question.length > 10) {
                tripleStumperMap.set(question.substring(0, 100), isTripleStumper)
            }
        })
    } catch (error) {
        console.error(`Error scraping episode ${episodeId}:`, error instanceof Error ? error.message : 'Unknown error')
    }
    
    return tripleStumperMap
}

async function main() {
    console.log('🔄 Starting triple stumper update from J-Archive...')
    
    // Get unique episode IDs
    const episodes = await prisma.question.groupBy({
        by: ['episodeId'],
        where: { episodeId: { not: null } }
    })
    
    console.log(`📊 Found ${episodes.length} unique episodes to check`)
    
    let totalUpdated = 0
    let totalTripleStumpers = 0
    
    for (let i = 0; i < episodes.length; i++) {
        const episodeId = episodes[i].episodeId
        if (!episodeId) continue
        
        console.log(`Processing episode ${episodeId} (${i + 1}/${episodes.length})...`)
        
        // Scrape the episode for triple stumper info
        const tripleStumperMap = await scrapeEpisodeTripleStumpers(episodeId)
        
        // Get all questions from this episode
        const questions = await prisma.question.findMany({
            where: { episodeId },
            select: { id: true, question: true }
        })
        
        // Update questions that are triple stumpers
        for (const q of questions) {
            const questionPrefix = q.question.substring(0, 100)
            const isTripleStumper = tripleStumperMap.get(questionPrefix) || false
            
            if (isTripleStumper) {
                await prisma.question.update({
                    where: { id: q.id },
                    data: { wasTripleStumper: true }
                })
                totalTripleStumpers++
            }
            totalUpdated++
        }
        
        // Rate limiting - wait 500ms between episodes to be nice to J-Archive
        await delay(500)
    }
    
    console.log(`\n✅ Processed ${totalUpdated} questions`)
    console.log(`🎯 Found and marked ${totalTripleStumpers} triple stumpers`)
    
    // Verify
    const dbCount = await prisma.question.count({
        where: { wasTripleStumper: true }
    })
    console.log(`📊 Total triple stumpers in database: ${dbCount}`)
}

main()
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
