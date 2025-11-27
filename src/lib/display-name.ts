/**
 * Generate a random display name for users
 * Combines a random adjective with a random noun
 */
export function generateRandomDisplayName(): string {
    const adjectives = ['Quick', 'Clever', 'Bright', 'Sharp', 'Smart', 'Witty', 'Wise', 'Bold', 'Eager', 'Grand']
    const nouns = ['Scholar', 'Thinker', 'Master', 'Champion', 'Expert', 'Genius', 'Sage', 'Mind', 'Brain', 'Ace']

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)]

    return `${randomAdjective}${randomNoun}`
}

