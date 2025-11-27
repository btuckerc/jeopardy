import { describe, it, expect } from 'vitest'
import { checkAnswer, calculatePoints } from './answer-checker'

describe('checkAnswer', () => {
    describe('hyphen/space/punctuation variants', () => {
        it('treats "cray-cray" and "cray cray" as equivalent', () => {
            expect(checkAnswer('cray cray', 'cray-cray')).toBe(true)
            expect(checkAnswer('cray-cray', 'cray cray')).toBe(true)
        })

        it('treats "craycray" and "cray-cray" as equivalent', () => {
            expect(checkAnswer('craycray', 'cray-cray')).toBe(true)
            expect(checkAnswer('cray-cray', 'craycray')).toBe(true)
        })

        it('handles multiple hyphens', () => {
            expect(checkAnswer('rock and roll', 'rock-and-roll')).toBe(true)
            expect(checkAnswer('rock-and-roll', 'rock and roll')).toBe(true)
        })

        it('ignores trailing punctuation', () => {
            expect(checkAnswer('paris!', 'Paris')).toBe(true)
            expect(checkAnswer('paris?', 'Paris')).toBe(true)
            expect(checkAnswer('paris...', 'Paris')).toBe(true)
        })

        it('handles apostrophes gracefully', () => {
            expect(checkAnswer("don't", 'dont')).toBe(true)
            expect(checkAnswer('dont', "don't")).toBe(true)
        })
    })

    describe('case insensitivity', () => {
        it('ignores case differences', () => {
            expect(checkAnswer('PARIS', 'paris')).toBe(true)
            expect(checkAnswer('Paris', 'PARIS')).toBe(true)
            expect(checkAnswer('pArIs', 'Paris')).toBe(true)
        })
    })

    describe('optional "what is" / "who is" phrasing', () => {
        it('accepts answers without question phrasing', () => {
            expect(checkAnswer('Paris', 'Paris')).toBe(true)
        })

        it('accepts answers with "what is"', () => {
            expect(checkAnswer('what is Paris', 'Paris')).toBe(true)
            expect(checkAnswer('What is Paris', 'Paris')).toBe(true)
        })

        it('accepts answers with "who is"', () => {
            expect(checkAnswer('who is Einstein', 'Einstein')).toBe(true)
            expect(checkAnswer('Who is Einstein', 'Einstein')).toBe(true)
        })

        it('accepts answers with "what are"', () => {
            expect(checkAnswer('what are dolphins', 'dolphins')).toBe(true)
        })

        it('accepts answers with "where is"', () => {
            expect(checkAnswer('where is France', 'France')).toBe(true)
        })
    })

    describe('articles and pronouns', () => {
        it('handles leading articles (the, a, an)', () => {
            expect(checkAnswer('the Eiffel Tower', 'Eiffel Tower')).toBe(true)
            expect(checkAnswer('Eiffel Tower', 'the Eiffel Tower')).toBe(true)
            expect(checkAnswer('a dog', 'dog')).toBe(true)
            expect(checkAnswer('an apple', 'apple')).toBe(true)
        })

        it('handles possessive pronouns', () => {
            expect(checkAnswer('my dog', 'dog')).toBe(true)
            expect(checkAnswer('his car', 'car')).toBe(true)
        })
    })

    describe('equivalent terms', () => {
        it('recognizes USA variants', () => {
            expect(checkAnswer('USA', 'United States')).toBe(true)
            expect(checkAnswer('US', 'United States of America')).toBe(true)
            expect(checkAnswer('United States', 'USA')).toBe(true)
        })

        it('recognizes World War variants', () => {
            expect(checkAnswer('WWI', 'World War 1')).toBe(true)
            expect(checkAnswer('WW1', 'First World War')).toBe(true)
            expect(checkAnswer('WWII', 'World War 2')).toBe(true)
            expect(checkAnswer('WW2', 'Second World War')).toBe(true)
        })

        it('recognizes UK variants', () => {
            expect(checkAnswer('UK', 'United Kingdom')).toBe(true)
            expect(checkAnswer('Great Britain', 'United Kingdom')).toBe(true)
        })
    })

    describe('phonetic/fuzzy matching for short answers', () => {
        it('accepts phonetically similar single-word answers', () => {
            // The phonetic algorithm groups similar sounds together
            // For short answers (1-2 words), phonetic matching is applied
            expect(checkAnswer('kolor', 'color')).toBe(true)  // c/k are same phonetic group, o->a
        })

        it('handles accented characters vs phonetic spelling', () => {
            // "Bébé" and "baybay" sound identical when spoken
            expect(checkAnswer('baybay', 'Bébé')).toBe(true)
            expect(checkAnswer('bebe', 'Bébé')).toBe(true)
            // Other accented examples
            expect(checkAnswer('cafe', 'café')).toBe(true)
            expect(checkAnswer('naive', 'naïve')).toBe(true)
            expect(checkAnswer('resume', 'résumé')).toBe(true)
        })

        it('handles common sound-alike patterns', () => {
            expect(checkAnswer('fone', 'phone')).toBe(true)  // ph -> f
            expect(checkAnswer('foto', 'photo')).toBe(true)  // ph -> f
        })

        it('handles minor spelling typos', () => {
            // "abby" vs "abbey" - just one letter difference
            expect(checkAnswer('Westminster Abby', 'Westminster Abbey')).toBe(true)
            expect(checkAnswer('abby', 'abbey')).toBe(true)
            // Other common typos
            expect(checkAnswer('recieve', 'receive')).toBe(true)
        })

        it('rejects short words that are different', () => {
            // These are completely different words and should NOT match
            // even though they have similar edit distance ratios
            expect(checkAnswer('eb', 'er')).toBe(false)
            expect(checkAnswer('at', 'an')).toBe(false)
            expect(checkAnswer('cat', 'car')).toBe(false)
            expect(checkAnswer('dog', 'dig')).toBe(false)
        })

        it('rejects anagrams (same letters, different order)', () => {
            // These have the same letters rearranged - should NOT match
            expect(checkAnswer('oki oki', 'iko iko')).toBe(false)
            expect(checkAnswer('oki', 'iko')).toBe(false)
            expect(checkAnswer('tac', 'cat')).toBe(false)
            expect(checkAnswer('god', 'dog')).toBe(false)
        })

        it('accepts palindromes and repeated-letter words when typed correctly', () => {
            // These are legitimate answers that happen to be palindromes or have patterns
            expect(checkAnswer('gag', 'gag')).toBe(true)
            expect(checkAnswer('racecar', 'racecar')).toBe(true)
            expect(checkAnswer('taco cat', 'taco cat')).toBe(true)
            expect(checkAnswer('mom', 'mom')).toBe(true)
            expect(checkAnswer('noon', 'noon')).toBe(true)
        })
    })

    describe('lists', () => {
        it('accepts list items in any order', () => {
            expect(checkAnswer('salt and pepper', 'pepper and salt')).toBe(true)
            // Note: proper noun detection may affect list handling
        })

        it('handles & as and', () => {
            expect(checkAnswer('salt & pepper', 'salt and pepper')).toBe(true)
        })
    })

    describe('parenthetical answers', () => {
        it('accepts answer without parenthetical content', () => {
            expect(checkAnswer('Abraham Lincoln', 'Abraham Lincoln (or Honest Abe)')).toBe(true)
        })

        it('accepts the parenthetical alternative', () => {
            expect(checkAnswer('Honest Abe', 'Abraham Lincoln (or Honest Abe)')).toBe(true)
        })
    })

    describe('longer answers', () => {
        it('accepts answers where most words match (80%)', () => {
            // For 3+ word answers, 80% of words must match
            // 3 out of 3 words match = 100%
            expect(checkAnswer('New York City', 'New York City')).toBe(true)
        })

        it('rejects answers with too few matching words', () => {
            // Only 2 out of 5 words match = 40%
            expect(checkAnswer('the slow red cat sits', 'the quick brown fox jumps')).toBe(false)
        })
    })

    describe('edge cases that should NOT match', () => {
        it('rejects completely different answers', () => {
            expect(checkAnswer('Paris', 'London')).toBe(false)
            expect(checkAnswer('dog', 'cat')).toBe(false)
        })

        it('rejects answers with different core meaning', () => {
            expect(checkAnswer('George Washington', 'Abraham Lincoln')).toBe(false)
        })
    })
})

describe('calculatePoints', () => {
    it('gives full points for exact normalized match', () => {
        expect(calculatePoints('Paris', 'Paris', 200)).toBe(200)
        expect(calculatePoints('PARIS', 'paris', 200)).toBe(200)
    })

    it('gives full points for compressed match (hyphen/space variants)', () => {
        expect(calculatePoints('cray cray', 'cray-cray', 200)).toBe(200)
        expect(calculatePoints('rock and roll', 'rock-and-roll', 400)).toBe(400)
    })

    it('gives full points for close matches that pass checkAnswer', () => {
        expect(calculatePoints('what is Paris', 'Paris', 200)).toBe(200)
        expect(calculatePoints('USA', 'United States', 200)).toBe(200)
    })

    it('gives zero points for incorrect answers', () => {
        expect(calculatePoints('London', 'Paris', 200)).toBe(0)
        expect(calculatePoints('cat', 'dog', 200)).toBe(0)
    })
})

