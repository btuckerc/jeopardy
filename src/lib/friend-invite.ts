export const FRIEND_CODE_LENGTH = 10
export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeFriendCode(input: string): string {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isFriendCodeCandidate(input: string): boolean {
    const normalized = normalizeFriendCode(input)
    if (normalized.length !== FRIEND_CODE_LENGTH) {
        return false
    }

    return normalized.split('').every((character) => FRIEND_CODE_ALPHABET.includes(character))
}

export function formatFriendCode(input: string): string {
    const normalized = normalizeFriendCode(input)
    if (!normalized) {
        return ''
    }

    const parts = normalized.match(/.{1,5}/g)
    return parts ? parts.join('-') : normalized
}

export function extractInviteTokenFromInput(input: string): string | null {
    const trimmed = input.trim()
    if (!trimmed) {
        return null
    }

    try {
        const parsed = new URL(trimmed)
        return parsed.searchParams.get('invite')
    } catch {
        return null
    }
}
