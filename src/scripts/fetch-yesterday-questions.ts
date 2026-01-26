import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
import { spawn } from 'child_process'
import path from 'path'
import axios from 'axios'
import { subDays, format } from 'date-fns'
import * as cheerio from 'cheerio'

const _prisma = new PrismaClient() // Reserved for future use

interface JeopardyQuestion {
    id: string
    question: string
    answer: string
    value: number
    category: string
    knowledgeCategory?: 'GEOGRAPHY_AND_HISTORY' | 'ENTERTAINMENT' | 'ARTS_AND_LITERATURE' | 'SCIENCE_AND_NATURE' | 'SPORTS_AND_LEISURE' | 'GENERAL_KNOWLEDGE'
    airDate?: string
    season?: number
    episodeId?: string
    wasTripleStumper?: boolean
    isDoubleJeopardy?: boolean
}

async function getYesterdayGame(): Promise<JeopardyQuestion[]> {
    const yesterday = subDays(new Date(), 1)
    const formattedDate = format(yesterday, 'yyyy-MM-dd')

    try {
        // First, get the game ID for yesterday's date
        const searchUrl = `https://j-archive.com/search.php?query=&search_type=date&when_day=${format(yesterday, 'dd')}&when_month=${format(yesterday, 'MM')}&when_year=${format(yesterday, 'yyyy')}`
        const searchResponse = await axios.get(searchUrl)
        const $ = cheerio.load(searchResponse.data)

        // Find the game link for yesterday's date
        const gameLink = $('a').filter((_, el) => $(el).text().includes(formattedDate)).first().attr('href')

        if (!gameLink) {
            console.log('No game found for yesterday')
            return []
        }

        // Get the game data
        const gameResponse = await axios.get(gameLink)
        const game$ = cheerio.load(gameResponse.data)

        const questions: JeopardyQuestion[] = []

        // Parse game data (you'll need to adapt this based on the actual HTML structure)
        game$('.clue').each((_, clue) => {
            const $clue = game$(clue)
            const question = $clue.find('.clue_text').text().trim()
            const answer = $clue.find('.correct_response').text().trim()
            const value = parseInt($clue.find('.clue_value').text().replace('$', '').replace(',', '')) || 0
            const category = $clue.closest('table').find('.category_name').text().trim()

            if (question && answer) {
                questions.push({
                    id: Math.random().toString(36).substring(7),
                    question,
                    answer,
                    value,
                    category,
                    airDate: formattedDate,
                    season: parseInt(gameLink.match(/game_id=(\d+)/)?.[1] || '0'),
                    episodeId: gameLink.split('id=')[1]
                })
            }
        })

        return questions
    } catch (error) {
        console.error('Error fetching yesterday\'s game:', error)
        return []
    }
}

async function main() {
    try {
        console.log('Fetching yesterday\'s questions...')

        const questions = await getYesterdayGame()

        if (questions.length === 0) {
            console.log('No questions found for yesterday')
            return
        }

        // Save to local file
        const dataPath = path.join(process.cwd(), 'data', 'jeopardy_questions.json')
        writeFileSync(dataPath, JSON.stringify(questions, null, 2))

        console.log(`Saved ${questions.length} questions from yesterday's game`)

        // Run the update script
        const updateProcess = spawn('npx', [
            'ts-node',
            'src/scripts/update-prod-questions.ts'
        ], {
            env: {
                ...process.env,
                NODE_ENV: 'production'
            },
            stdio: 'inherit'
        })

        updateProcess.on('close', (code: number) => {
            if (code === 0) {
                console.log('Successfully updated database with yesterday\'s questions')
            } else {
                console.error('Error updating database')
                process.exit(1)
            }
        })

    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

main() 