// Categorized avatar emoji definitions
export type EmojiCategory = 'on_theme' | 'animals' | 'knowledge' | 'science' | 'misc'

export interface EmojiDefinition {
    emoji: string
    name: string
    category: EmojiCategory
}

// Categorized emoji list for UI rendering
// Note: chosen for broad cross-platform support (classic Unicode emoji)
export const CATEGORIZED_EMOJIS: EmojiDefinition[] = [
    // On-theme (Jeopardy/game show & competition)
    { emoji: '🎯', name: 'Target', category: 'on_theme' },
    { emoji: '🏆', name: 'Trophy', category: 'on_theme' },
    { emoji: '🏅', name: 'Medal', category: 'on_theme' },
    { emoji: '⭐', name: 'Star', category: 'on_theme' },
    { emoji: '🌟', name: 'Sparkles', category: 'on_theme' },
    { emoji: '🎪', name: 'Show', category: 'on_theme' },
    { emoji: '🎤', name: 'Host', category: 'on_theme' },
    { emoji: '📺', name: 'TV', category: 'on_theme' },
    { emoji: '🎮', name: 'Game', category: 'on_theme' },
    { emoji: '🎲', name: 'Dice', category: 'on_theme' },
    { emoji: '🎭', name: 'Masks', category: 'on_theme' },
    { emoji: '🎥', name: 'Camera', category: 'on_theme' },
    { emoji: '🕹️', name: 'Joystick', category: 'on_theme' },
    { emoji: '🧩', name: 'Puzzle', category: 'on_theme' },
    
    // Animals (popular, recognizable)
    { emoji: '🦅', name: 'Eagle', category: 'animals' },
    { emoji: '🦉', name: 'Owl', category: 'animals' },
    { emoji: '🦁', name: 'Lion', category: 'animals' },
    { emoji: '🐱', name: 'Cat', category: 'animals' },
    { emoji: '🐶', name: 'Dog', category: 'animals' },
    { emoji: '🐺', name: 'Wolf', category: 'animals' },
    { emoji: '🐻', name: 'Bear', category: 'animals' },
    { emoji: '🦊', name: 'Fox', category: 'animals' },
    { emoji: '🐼', name: 'Panda', category: 'animals' },
    { emoji: '🐵', name: 'Monkey', category: 'animals' },
    { emoji: '🐧', name: 'Penguin', category: 'animals' },
    { emoji: '🐬', name: 'Dolphin', category: 'animals' },
    
    // Knowledge & Learning / \"smart\" vibes
    { emoji: '🎓', name: 'Graduation Cap', category: 'knowledge' },
    { emoji: '📖', name: 'Scholar', category: 'knowledge' },
    { emoji: '📚', name: 'Books', category: 'knowledge' },
    { emoji: '🧠', name: 'Brain', category: 'knowledge' },
    { emoji: '💡', name: 'Idea', category: 'knowledge' },
    { emoji: '💭', name: 'Thinking', category: 'knowledge' },
    { emoji: '🧑‍🏫', name: 'Teacher', category: 'knowledge' },
    { emoji: '🕵️‍♂️', name: 'Detective', category: 'knowledge' },
    { emoji: '🔍', name: 'Search', category: 'knowledge' },
    { emoji: '❓', name: 'Question', category: 'knowledge' },
    { emoji: '📜', name: 'Scroll', category: 'knowledge' },
    { emoji: '📊', name: 'Chart', category: 'knowledge' },
    
    // Science & Technology
    { emoji: '🔬', name: 'Microscope', category: 'science' },
    { emoji: '🌍', name: 'Globe', category: 'science' },
    { emoji: '🚀', name: 'Rocket', category: 'science' },
    { emoji: '🌀', name: 'Cyclone', category: 'science' },
    { emoji: '💻', name: 'Laptop', category: 'science' },
    { emoji: '📡', name: 'Satellite', category: 'science' },
    
    // Misc (personality-forward but broadly supported)
    { emoji: '😀', name: 'Smile', category: 'misc' },
    { emoji: '😎', name: 'Cool', category: 'misc' },
    { emoji: '🤓', name: 'Nerd', category: 'misc' },
    { emoji: '🤖', name: 'Robot', category: 'misc' },
    { emoji: '👑', name: 'Crown', category: 'misc' },
    { emoji: '🕒', name: 'Clock', category: 'misc' },
]

// Map format for backward compatibility (emoji -> name)
export const PROFILE_ICONS = Object.fromEntries(
    CATEGORIZED_EMOJIS.map(e => [e.emoji, e.name])
) as Record<string, string>

// Get all valid emoji strings
export const VALID_EMOJIS = new Set(CATEGORIZED_EMOJIS.map(e => e.emoji))

// Helper to get emojis by category
export function getEmojisByCategory(category: EmojiCategory | 'all'): EmojiDefinition[] {
    if (category === 'all') {
        return CATEGORIZED_EMOJIS
    }
    return CATEGORIZED_EMOJIS.filter(e => e.category === category)
}

// Curated palette of avatar background themes
export const AVATAR_BACKGROUNDS = {
    blue: {
        name: 'Ocean',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.8), rgba(30, 64, 175, 1))',
        shadow: '0 4px 12px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    purple: {
        name: 'Violet',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.8), rgba(109, 40, 217, 1))',
        shadow: '0 4px 12px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    teal: {
        name: 'Lagoon',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(45, 212, 191, 0.3), rgba(20, 184, 166, 0.8), rgba(13, 148, 136, 1))',
        shadow: '0 4px 12px rgba(20, 184, 166, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    rose: {
        name: 'Sunset',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(251, 113, 133, 0.3), rgba(244, 63, 94, 0.8), rgba(225, 29, 72, 1))',
        shadow: '0 4px 12px rgba(244, 63, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    amber: {
        name: 'Gold',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 1))',
        shadow: '0 4px 12px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    slate: {
        name: 'Graphite',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(100, 116, 139, 0.3), rgba(71, 85, 105, 0.8), rgba(51, 65, 85, 1))',
        shadow: '0 4px 12px rgba(71, 85, 105, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
} as const

export type AvatarBackgroundKey = keyof typeof AVATAR_BACKGROUNDS

// Get all valid background keys
export const VALID_BACKGROUNDS = new Set(Object.keys(AVATAR_BACKGROUNDS) as AvatarBackgroundKey[])

