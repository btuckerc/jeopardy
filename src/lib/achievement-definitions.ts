/**
 * Achievement definitions for the Jeopardy app
 * 
 * This file contains all achievement metadata: codes, names, descriptions, icons, and categories.
 * Achievements are organized by category for easier management and future UI grouping.
 */

export type AchievementCategory = 
    | 'onboarding'
    | 'streak'
    | 'volume'
    | 'skill'
    | 'knowledge'
    | 'hidden'

export interface AchievementDefinition {
    code: string
    name: string
    description: string
    icon: string
    category: AchievementCategory
    isHidden?: boolean
    tier?: number // For tiered achievements (1 = easiest, higher = harder)
}

/**
 * Complete list of all achievements in the system
 * 
 * Categories:
 * - onboarding: Early wins that welcome new players
 * - streak: Daily play consistency achievements
 * - volume: Total questions answered milestones
 * - skill: Performance-based achievements (scores, accuracy)
 * - knowledge: Category-specific or knowledge-based achievements
 * - hidden: Secret achievements that aren't shown until unlocked
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
    // ============================================
    // ONBOARDING & EARLY WINS
    // ============================================
    {
        code: 'FIRST_GAME',
        name: 'Welcome to the Stage',
        description: 'Complete your first game',
        icon: '🎬',
        category: 'onboarding',
        tier: 1
    },
    {
        code: 'FIRST_CORRECT',
        name: 'In the Black',
        description: 'Answer your first question correctly',
        icon: '✅',
        category: 'onboarding',
        tier: 1
    },
    {
        code: 'FIRST_DAILY_CHALLENGE',
        name: 'Daily Debut',
        description: 'Complete your first daily challenge',
        icon: '📆',
        category: 'onboarding',
        tier: 1
    },
    {
        code: 'FIRST_TRIPLE_STUMPER',
        name: 'Stumped No More',
        description: 'Answer your first triple stumper correctly',
        icon: '🧩',
        category: 'onboarding',
        tier: 1
    },
    {
        code: 'FIRST_PERFECT_ROUND',
        name: 'Flawless First',
        description: 'Answer every question correctly in a single round',
        icon: '✨',
        category: 'onboarding',
        tier: 2
    },
    {
        code: 'PROFILE_CUSTOMIZED',
        name: 'Make It Yours',
        description: 'Customize your display name and icon',
        icon: '🎨',
        category: 'onboarding',
        tier: 1
    },

    // ============================================
    // STREAK & HABIT ACHIEVEMENTS
    // ============================================
    {
        code: 'STREAK_3',
        name: 'Getting Started',
        description: 'Maintain a 3-day playing streak',
        icon: '🌱',
        category: 'streak',
        tier: 1
    },
    {
        code: 'STREAK_7',
        name: 'Week Warrior',
        description: 'Maintain a 7-day playing streak',
        icon: '🔥',
        category: 'streak',
        tier: 2
    },
    {
        code: 'STREAK_14',
        name: 'Fortnight Focus',
        description: 'Maintain a 14-day playing streak',
        icon: '⚡',
        category: 'streak',
        tier: 3
    },
    {
        code: 'STREAK_30',
        name: 'Monthly Master',
        description: 'Maintain a 30-day playing streak',
        icon: '💪',
        category: 'streak',
        tier: 4
    },
    {
        code: 'STREAK_100',
        name: 'Centurion',
        description: 'Maintain a 100-day playing streak',
        icon: '👑',
        category: 'streak',
        tier: 5
    },
    {
        code: 'DAILY_CHALLENGE_STREAK_3',
        name: 'Daily Devotee',
        description: 'Complete 3 daily challenges in a row',
        icon: '📅',
        category: 'streak',
        tier: 1
    },
    {
        code: 'DAILY_CHALLENGE_STREAK_7',
        name: 'Week of Wisdom',
        description: 'Complete 7 daily challenges in a row',
        icon: '📆',
        category: 'streak',
        tier: 2
    },
    {
        code: 'DAILY_CHALLENGE_STREAK_30',
        name: 'Month of Mastery',
        description: 'Complete 30 daily challenges in a row',
        icon: '🗓️',
        category: 'streak',
        tier: 4
    },
    {
        code: 'RETURNING_PLAYER',
        name: 'Back in the Game',
        description: 'Return after not playing for 7+ days',
        icon: '🔄',
        category: 'streak',
        tier: 1
    },

    // ============================================
    // VOLUME & MASTERY ACHIEVEMENTS
    // ============================================
    {
        code: 'QUESTIONS_50',
        name: 'Getting Warmed Up',
        description: 'Answer 50 questions',
        icon: '📚',
        category: 'volume',
        tier: 1
    },
    {
        code: 'QUESTIONS_100',
        name: 'Century Club',
        description: 'Answer 100 questions',
        icon: '💯',
        category: 'volume',
        tier: 2
    },
    {
        code: 'QUESTIONS_500',
        name: 'Half a Grand',
        description: 'Answer 500 questions',
        icon: '📖',
        category: 'volume',
        tier: 3
    },
    {
        code: 'QUESTIONS_1000',
        name: 'Millennium Master',
        description: 'Answer 1,000 questions',
        icon: '🌟',
        category: 'volume',
        tier: 4
    },
    {
        code: 'QUESTIONS_5000',
        name: 'Knowledge Keeper',
        description: 'Answer 5,000 questions',
        icon: '📜',
        category: 'volume',
        tier: 5
    },
    {
        code: 'TRIPLE_STUMPER_10',
        name: 'Stumper Solver',
        description: 'Answer 10 triple stumpers correctly',
        icon: '🧠',
        category: 'volume',
        tier: 2
    },
    {
        code: 'TRIPLE_STUMPER_50',
        name: 'Stumper Specialist',
        description: 'Answer 50 triple stumpers correctly',
        icon: '🎯',
        category: 'volume',
        tier: 3
    },
    {
        code: 'TRIPLE_STUMPER_100',
        name: 'Stumper Sage',
        description: 'Answer 100 triple stumpers correctly',
        icon: '🏛️',
        category: 'volume',
        tier: 4
    },
    {
        code: 'GAMES_COMPLETED_10',
        name: 'Regular Player',
        description: 'Complete 10 games',
        icon: '🎮',
        category: 'volume',
        tier: 2
    },
    {
        code: 'GAMES_COMPLETED_50',
        name: 'Dedicated Competitor',
        description: 'Complete 50 games',
        icon: '🎯',
        category: 'volume',
        tier: 3
    },
    {
        code: 'GAMES_COMPLETED_100',
        name: 'Century of Games',
        description: 'Complete 100 games',
        icon: '🏆',
        category: 'volume',
        tier: 4
    },

    // ============================================
    // SKILL-BASED & CHALLENGE ACHIEVEMENTS
    // ============================================
    {
        code: 'PERFECT_ROUND',
        name: 'Perfect Round',
        description: 'Answer every question correctly in a single round',
        icon: '⭐',
        category: 'skill',
        tier: 2
    },
    {
        code: 'PERFECT_GAME',
        name: 'Flawless Victory',
        description: 'Answer every question correctly in a complete game',
        icon: '💎',
        category: 'skill',
        tier: 5
    },
    {
        code: 'SCORE_5000',
        name: 'Five Grand',
        description: 'Score $5,000 or more in a single game',
        icon: '💵',
        category: 'skill',
        tier: 1
    },
    {
        code: 'SCORE_10000',
        name: 'Ten Thousand Club',
        description: 'Score $10,000 or more in a single game',
        icon: '💰',
        category: 'skill',
        tier: 2
    },
    {
        code: 'SCORE_15000',
        name: 'Fifteen Grand',
        description: 'Score $15,000 or more in a single game',
        icon: '💸',
        category: 'skill',
        tier: 3
    },
    {
        code: 'SCORE_20000',
        name: 'Twenty Grand',
        description: 'Score $20,000 or more in a single game',
        icon: '🏆',
        category: 'skill',
        tier: 4
    },
    {
        code: 'SCORE_30000',
        name: 'Thirty Grand',
        description: 'Score $30,000 or more in a single game',
        icon: '👑',
        category: 'skill',
        tier: 5
    },
    {
        code: 'ACCURACY_80_PERCENT',
        name: 'Sharp Shooter',
        description: 'Achieve 80% accuracy across 50+ questions',
        icon: '🎯',
        category: 'skill',
        tier: 2
    },
    {
        code: 'ACCURACY_90_PERCENT',
        name: 'Precision Master',
        description: 'Achieve 90% accuracy across 100+ questions',
        icon: '🎖️',
        category: 'skill',
        tier: 3
    },
    {
        code: 'ACCURACY_95_PERCENT',
        name: 'Near Perfect',
        description: 'Achieve 95% accuracy across 200+ questions',
        icon: '💫',
        category: 'skill',
        tier: 4
    },
    {
        code: 'FINAL_JEOPARDY_CORRECT',
        name: 'Final Answer',
        description: 'Answer a Final Jeopardy question correctly',
        icon: '🎭',
        category: 'skill',
        tier: 2
    },
    {
        code: 'FINAL_JEOPARDY_STREAK_5',
        name: 'Final Five',
        description: 'Answer 5 Final Jeopardy questions correctly',
        icon: '🎪',
        category: 'skill',
        tier: 3
    },

    // ============================================
    // KNOWLEDGE & CATEGORY ACHIEVEMENTS
    // ============================================
    {
        code: 'CATEGORY_MASTER_GEOGRAPHY',
        name: 'World Traveler',
        description: 'Answer 50 Geography & History questions correctly',
        icon: '🌍',
        category: 'knowledge',
        tier: 2
    },
    {
        code: 'CATEGORY_MASTER_ENTERTAINMENT',
        name: 'Pop Culture Pro',
        description: 'Answer 50 Entertainment questions correctly',
        icon: '🎬',
        category: 'knowledge',
        tier: 2
    },
    {
        code: 'CATEGORY_MASTER_ARTS',
        name: 'Renaissance Mind',
        description: 'Answer 50 Arts & Literature questions correctly',
        icon: '🎨',
        category: 'knowledge',
        tier: 2
    },
    {
        code: 'CATEGORY_MASTER_SCIENCE',
        name: 'Science Scholar',
        description: 'Answer 50 Science & Nature questions correctly',
        icon: '🔬',
        category: 'knowledge',
        tier: 2
    },
    {
        code: 'CATEGORY_MASTER_SPORTS',
        name: 'Sports Savant',
        description: 'Answer 50 Sports & Leisure questions correctly',
        icon: '⚽',
        category: 'knowledge',
        tier: 2
    },
    {
        code: 'CATEGORY_MASTER_GENERAL',
        name: 'Generalist',
        description: 'Answer 50 General Knowledge questions correctly',
        icon: '📚',
        category: 'knowledge',
        tier: 2
    },
    {
        code: 'ALL_CATEGORIES_MASTER',
        name: 'Renaissance Person',
        description: 'Master all six knowledge categories (50+ correct in each)',
        icon: '🎓',
        category: 'knowledge',
        tier: 4
    },

    // ============================================
    // HIDDEN & PLAYFUL ACHIEVEMENTS
    // ============================================
    {
        code: 'STREAK_69',
        name: 'Nice',
        description: 'Maintain a 69-day playing streak',
        icon: '😏',
        category: 'hidden',
        isHidden: true,
        tier: 3
    },
    {
        code: 'QUESTIONS_1337',
        name: 'Leet Knowledge',
        description: 'Answer 1,337 questions',
        icon: '💻',
        category: 'hidden',
        isHidden: true,
        tier: 3
    },
    {
        code: 'SCORE_1984',
        name: 'Big Brother',
        description: 'Score exactly $1,984 in a game',
        icon: '📖',
        category: 'hidden',
        isHidden: true,
        tier: 2
    },
    {
        code: 'DAILY_CHALLENGE_MIDNIGHT',
        name: 'Night Owl',
        description: 'Complete a daily challenge between midnight and 3 AM',
        icon: '🦉',
        category: 'hidden',
        isHidden: true,
        tier: 1
    },
    {
        code: 'PERFECT_ROUND_DOUBLE_JEOPARDY',
        name: 'Double Down',
        description: 'Answer every question correctly in a Double Jeopardy round',
        icon: '⚡',
        category: 'hidden',
        isHidden: true,
        tier: 4
    },
    {
        code: 'ALL_HIDDEN',
        name: 'Secret Keeper',
        description: 'Unlock all hidden achievements',
        icon: '🔐',
        category: 'hidden',
        isHidden: true,
        tier: 5
    }
]

/**
 * Get achievement definition by code
 */
export function getAchievementByCode(code: string): AchievementDefinition | undefined {
    return ACHIEVEMENT_DEFINITIONS.find(a => a.code === code)
}

/**
 * Get all achievements in a category
 */
export function getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[] {
    return ACHIEVEMENT_DEFINITIONS.filter(a => a.category === category)
}

/**
 * Get all visible (non-hidden) achievements
 */
export function getVisibleAchievements(): AchievementDefinition[] {
    return ACHIEVEMENT_DEFINITIONS.filter(a => !a.isHidden)
}

/**
 * Get all hidden achievements
 */
export function getHiddenAchievements(): AchievementDefinition[] {
    return ACHIEVEMENT_DEFINITIONS.filter(a => a.isHidden === true)
}

