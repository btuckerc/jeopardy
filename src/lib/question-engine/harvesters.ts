/**
 * Clean-Room CC0 / Public Domain Structured Data Harvesters
 *
 * Strictly harvests ONLY allowlisted CC0 1.0 Universal and verified Public Domain
 * structured sources:
 *   1. Wikidata SPARQL (CC0-1.0, including CC0 schema:description & structured triples)
 *   2. The Met Museum Open Access API v1.1 (CC0-1.0, strictly isPublicDomain === true)
 *   3. MusicBrainz Core Web Service (CC0-1.0, core fields ONLY — never NC tags/annotations)
 *   4. Project Gutenberg / Gutendex (Public-Domain, pre-1928 works, boilerplate stripped)
 *   5. Code-Verified Wordplay Clustering over harvested CC0 Wikidata entities
 *
 * ZERO Wikipedia prose. ZERO Wiktionary CC BY-SA. ZERO J-Archive.
 */

import crypto from 'crypto'
import type { JeopardyRound, KnowledgeCategory } from '@prisma/client'
import { verifyWordplayRule } from './validators'
import type {
    CategoryArchetype,
    FactBundle,
    SourceFactRecord,
    WordplayRule,
} from './types'

const USER_AGENT = 'TrivrdyCleanRoomEngine/1.0 (https://trivrdy.com; CC0/PD fact harvester)'

export interface HarvestRecipe {
    id: string
    knowledgeCategory: KnowledgeCategory
    archetype: CategoryArchetype
    themeHint: string
    sourceSystem: 'WIKIDATA_CC0' | 'MET_OPEN_ACCESS_CC0' | 'MUSICBRAINZ_CORE_CC0' | 'PROJECT_GUTENBERG_PD'
    sparql?: string
    metQuery?: string
    musicbrainzQueries?: string[]
    wordplayRule?: WordplayRule
}

/**
 * High-notability, timeout-safe CC0 / Public Domain harvest recipes evenly spanning
 * all 6 KnowledgeCategory domains. Uses wikibase:sitelinks ordering on bounded classes
 * so categories draw from household-iconic cultural/educational entities rather than
 * obscure database rows.
 */
export const HARVEST_RECIPES: HarvestRecipe[] = [
    // ==================== GEOGRAPHY_AND_HISTORY ====================
    {
        id: 'wd-world-capitals',
        knowledgeCategory: 'GEOGRAPHY_AND_HISTORY',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'WORLD CAPITALS — Major sovereign world capitals (geography, waterways, nicknames, history — avoid trivial "capital of X" giveaways)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?countryLabel ?continentLabel WHERE {
  ?country wdt:P31 wd:Q3624078; wdt:P36 ?item; wdt:P30 ?continent; wikibase:sitelinks ?sl.
  FILTER(?sl > 110)
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 55`,
    },
    {
        id: 'wd-us-presidents',
        knowledgeCategory: 'GEOGRAPHY_AND_HISTORY',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'U.S. PRESIDENTS — American presidents (birthplaces, eras, political parties, nicknames, historical legacy)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?birthPlaceLabel ?birthYear ?deathYear ?partyLabel WHERE {
  ?item wdt:P39 wd:Q11696; wikibase:sitelinks ?sl.
  OPTIONAL { ?item wdt:P19 ?birthPlace. }
  OPTIONAL { ?item wdt:P569 ?birthYear. }
  OPTIONAL { ?item wdt:P570 ?deathYear. }
  OPTIONAL { ?item wdt:P102 ?party. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 46`,
    },
    {
        id: 'wd-us-states',
        knowledgeCategory: 'GEOGRAPHY_AND_HISTORY',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'U.S. STATES — The 50 United States (capitals, nicknames, mottos, bodies of water, geography)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?capitalLabel WHERE {
  ?item wdt:P31 wd:Q35657; wdt:P36 ?capital; wikibase:sitelinks ?sl.
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 50`,
    },
    {
        id: 'wd-world-rivers',
        knowledgeCategory: 'GEOGRAPHY_AND_HISTORY',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'MAJOR WORLD RIVERS — Great rivers of the world (continents, countries, outflows, geography)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?continentLabel ?flowsIntoLabel WHERE {
  ?item wdt:P31 wd:Q4022; wdt:P2043 ?len; wikibase:sitelinks ?sl.
  FILTER(?len > 2000 && ?sl > 50)
  OPTIONAL { ?item wdt:P30 ?continent. }
  OPTIONAL { ?item wdt:P403 ?flowsInto. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 40`,
    },
    {
        id: 'wd-world-landmarks',
        knowledgeCategory: 'GEOGRAPHY_AND_HISTORY',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'WORLD LANDMARKS — Iconic UNESCO World Heritage sites & monuments (countries, builders, architectural styles, eras)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?countryLabel ?architectLabel ?styleLabel WHERE {
  ?item wdt:P1435 wd:Q9259; wdt:P17 ?country; wikibase:sitelinks ?sl.
  FILTER(?sl > 65)
  OPTIONAL { ?item wdt:P84 ?architect. }
  OPTIONAL { ?item wdt:P149 ?style. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 45`,
    },

    // ==================== SCIENCE_AND_NATURE ====================
    {
        id: 'wd-chemical-elements',
        knowledgeCategory: 'SCIENCE_AND_NATURE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'CHEMICAL ELEMENTS — The Periodic Table & element origins (properties, etymology, discoverers, uses — NO atomic-number giveaways)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?discovererLabel ?namedAfterLabel ?discoveryYear WHERE {
  ?item wdt:P31 wd:Q11344; wdt:P1086 ?atomicNumber; wikibase:sitelinks ?sl.
  FILTER(?atomicNumber <= 92)
  OPTIONAL { ?item wdt:P61 ?discoverer. }
  OPTIONAL { ?item wdt:P138 ?namedAfter. }
  OPTIONAL { ?item wdt:P575 ?discoveryYear. }
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 65`,
    },
    {
        id: 'wd-solar-system',
        knowledgeCategory: 'SCIENCE_AND_NATURE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'THE SOLAR SYSTEM — Planets, dwarf planets & major moons (orbits, discoveries, mythological namesakes)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?orbitsLabel ?discovererLabel ?discoveryYear ?namedAfterLabel WHERE {
  VALUES ?item { wd:Q308 wd:Q313 wd:Q2 wd:Q111 wd:Q319 wd:Q193 wd:Q324 wd:Q332 wd:Q339 wd:Q596 wd:Q405 wd:Q3123 wd:Q3143 wd:Q3134 wd:Q3169 wd:Q2565 wd:Q3303 wd:Q3359 wd:Q7547 wd:Q7548 wd:Q611 }
  OPTIONAL { ?item wdt:P397 ?orbits. }
  OPTIONAL { ?item wdt:P61 ?discoverer. }
  OPTIONAL { ?item wdt:P575 ?discoveryYear. }
  OPTIONAL { ?item wdt:P138 ?namedAfter. }
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 30`,
    },
    {
        id: 'wd-nobel-scientists',
        knowledgeCategory: 'SCIENCE_AND_NATURE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'NOBEL SCIENTISTS — Famous Nobel Prize laureates in Physics, Chemistry & Medicine (breakthroughs, fields, nationalities)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?awardLabel ?countryLabel ?fieldLabel ?birthYear WHERE {
  VALUES ?award { wd:Q38104 wd:Q44585 wd:Q80061 }
  ?item wdt:P166 ?award; wdt:P27 ?country; wikibase:sitelinks ?sl.
  FILTER(?sl > 55)
  OPTIONAL { ?item wdt:P101 ?field. }
  OPTIONAL { ?item wdt:P569 ?birthYear. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 45`,
    },
    {
        id: 'wd-constellations',
        knowledgeCategory: 'SCIENCE_AND_NATURE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'CONSTELLATIONS — Classic star patterns in the night sky (mythological namesakes, celestial lore)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?namedAfterLabel WHERE {
  ?item wdt:P31 wd:Q8928; wikibase:sitelinks ?sl.
  OPTIONAL { ?item wdt:P138 ?namedAfter. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 40`,
    },

    // ==================== ARTS_AND_LITERATURE ====================
    {
        id: 'wd-famous-paintings',
        knowledgeCategory: 'ARTS_AND_LITERATURE',
        archetype: 'FINE_ART_CURATED',
        themeHint: 'FAMOUS PAINTINGS — Iconic works in the Louvre, Met, MoMA, Prado, Uffizi, National Gallery & Rijksmuseum (artists, subjects, movements, museums)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?creatorLabel ?museumLabel ?movementLabel WHERE {
  VALUES ?museum { wd:Q19675 wd:Q160236 wd:Q188740 wd:Q160112 wd:Q180788 wd:Q51252 wd:Q190804 }
  ?item wdt:P31 wd:Q3305213; wdt:P276 ?museum; wdt:P170 ?creator; wikibase:sitelinks ?sl.
  FILTER(?sl > 25)
  OPTIONAL { ?item wdt:P135 ?movement. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 45`,
    },
    {
        id: 'wd-nobel-literature',
        knowledgeCategory: 'ARTS_AND_LITERATURE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'NOBEL AUTHORS — World-famous Nobel Literature laureates (notable novels, plays, poetry, nationalities)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?countryLabel ?notableWorkLabel ?birthYear WHERE {
  ?item wdt:P166 wd:Q37922; wdt:P27 ?country; wikibase:sitelinks ?sl.
  FILTER(?sl > 55)
  OPTIONAL { ?item wdt:P800 ?notableWork. }
  OPTIONAL { ?item wdt:P569 ?birthYear. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 45`,
    },
    {
        id: 'pg-classic-literature',
        knowledgeCategory: 'ARTS_AND_LITERATURE',
        archetype: 'LITERARY_PUBLIC_DOMAIN',
        themeHint: 'CLASSIC LITERATURE — Beloved public-domain novels & epics (authors, iconic plots, characters, eras)',
        sourceSystem: 'PROJECT_GUTENBERG_PD',
    },
    {
        id: 'met-fine-art',
        knowledgeCategory: 'ARTS_AND_LITERATURE',
        archetype: 'FINE_ART_CURATED',
        themeHint: 'FINE ART MASTERS — Public-domain painters and artworks from The Met Collection (artists, mediums, styles, eras)',
        sourceSystem: 'MET_OPEN_ACCESS_CC0',
        metQuery: 'painting',
    },

    // ==================== ENTERTAINMENT ====================
    {
        id: 'wd-best-picture-films',
        knowledgeCategory: 'ENTERTAINMENT',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'BEST PICTURE WINNERS — Academy Award Best Picture films (directors, stars, release years — use 2 crisp hooks, never over-stuff)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?directorLabel ?releaseYear WHERE {
  ?item wdt:P166 wd:Q102427; wdt:P57 ?director; wikibase:sitelinks ?sl.
  OPTIONAL { ?item wdt:P577 ?releaseYear. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 55`,
    },
    {
        id: 'wd-best-director-cinema',
        knowledgeCategory: 'ENTERTAINMENT',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'OSCAR-WINNING DIRECTORS — Acclaimed film directors (nationalities, signature films, cinematic movements)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?countryLabel ?notableWorkLabel WHERE {
  ?item wdt:P166 wd:Q103360; wdt:P27 ?country; wikibase:sitelinks ?sl.
  FILTER(?sl > 45)
  OPTIONAL { ?item wdt:P800 ?notableWork. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 45`,
    },
    {
        id: 'mb-composers-musicians',
        knowledgeCategory: 'ENTERTAINMENT',
        archetype: 'MUSIC_HISTORY',
        themeHint: 'MUSICAL LEGENDS — Classical composers & modern music icons (origins, eras, signature styles)',
        sourceSystem: 'MUSICBRAINZ_CORE_CC0',
        musicbrainzQueries: [
            'Ludwig van Beethoven', 'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach',
            'Frédéric Chopin', 'Antonio Vivaldi', 'Pyotr Ilyich Tchaikovsky',
            'Claude Debussy', 'Miles Davis', 'Duke Ellington', 'Aretha Franklin',
            'The Beatles', 'David Bowie', 'Nina Simone', 'Bob Dylan', 'Stevie Wonder',
        ],
    },

    // ==================== SPORTS_AND_LEISURE ====================
    {
        id: 'wd-olympic-sports',
        knowledgeCategory: 'SPORTS_AND_LEISURE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'OLYMPIC SPORTS — Classic Olympic disciplines & global sports (rules, origins, equipment, traditions)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?countryLabel WHERE {
  ?item wdt:P31 wd:Q212434; wikibase:sitelinks ?sl.
  FILTER(?sl > 45)
  OPTIONAL { ?item wdt:P495 ?country. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 40`,
    },
    {
        id: 'wd-famous-stadiums',
        knowledgeCategory: 'SPORTS_AND_LEISURE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'FAMOUS STADIUMS — Iconic sporting arenas around the world (cities, countries, sports, teams)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?cityLabel ?countryLabel ?sportLabel ?capacity WHERE {
  ?item wdt:P31 wd:Q483110; wdt:P17 ?country; wdt:P641 ?sport; wdt:P1083 ?capacity; wikibase:sitelinks ?sl.
  FILTER(?capacity > 60000 && ?sl > 35)
  OPTIONAL { ?item wdt:P131 ?city. }
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 40`,
    },

    // ==================== GENERAL_KNOWLEDGE ====================
    {
        id: 'wd-world-mythology',
        knowledgeCategory: 'GENERAL_KNOWLEDGE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'WORLD MYTHOLOGY — Iconic Greek, Norse & Egyptian gods and mythological figures (domains, symbols, myths)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?mythTypeLabel WHERE {
  VALUES ?mythType { wd:Q22989102 wd:Q16513881 wd:Q146083 }
  ?item wdt:P31 ?mythType; wikibase:sitelinks ?sl.
  FILTER(?sl > 55)
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 45`,
    },
    {
        id: 'wd-si-units-inventions',
        knowledgeCategory: 'GENERAL_KNOWLEDGE',
        archetype: 'CLASSIC_THEMATIC',
        themeHint: 'SCIENTIFIC UNITS — Famous SI & physics units and their scientist namesakes (physical quantities measured — never leak the scientist surname!)',
        sourceSystem: 'WIKIDATA_CC0',
        sparql: `
SELECT DISTINCT ?item ?itemLabel ?wikidataDesc ?namedAfterLabel ?measuresLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q47574; wdt:P138 ?namedAfter; wdt:P111 ?measures; wikibase:sitelinks ?sl.
  ?namedAfter wdt:P31 wd:Q5.
  FILTER(?sl > 45)
  ?item rdfs:label ?lbl. FILTER(LANG(?lbl) = "en")
  ?item schema:description ?wikidataDesc. FILTER(LANG(?wikidataDesc) = "en")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?sl) LIMIT 30`,
    },
]

function isCleanEnglishLabel(label: string | undefined): label is string {
    if (!label) return false
    const trimmed = label.trim()
    if (trimmed.length < 2 || trimmed.length > 55) return false
    if (/^Q\d+$/.test(trimmed)) return false
    if (/[{}\[\]|]/.test(trimmed)) return false
    return true
}

function cleanYear(val: string | undefined): string | undefined {
    if (!val) return undefined
    const m = val.match(/^-?(\d{3,4})/)
    if (!m) return undefined
    return val.startsWith('-') ? `${parseInt(m[1], 10)} BCE` : m[1]
}

/**
 * Fetch structured CC0 facts from Wikidata SPARQL endpoint with polite retry on 429/502/504.
 */
export async function harvestWikidataSparql(sparql: string): Promise<SourceFactRecord[]> {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}`
    let resp: Response | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
        resp = await fetch(url, {
            headers: {
                Accept: 'application/sparql-results+json',
                'User-Agent': USER_AGENT,
            },
            signal: AbortSignal.timeout(25_000),
        })
        if (resp.ok) break
        if (resp.status === 429 || resp.status >= 500) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
            continue
        }
        break
    }

    if (!resp || !resp.ok) {
        throw new Error(`Wikidata SPARQL HTTP ${resp?.status ?? 'network_error'}`)
    }

    const json = (await resp.json()) as {
        results: { bindings: Array<Record<string, { value: string; type: string }>> }
    }

    const fetchedAt = new Date().toISOString()
    const byEntity = new Map<string, SourceFactRecord>()

    for (const row of json.results.bindings) {
        const itemUri = row.item?.value
        const label = row.itemLabel?.value
        if (!itemUri || !isCleanEnglishLabel(label)) continue

        const qidMatch = itemUri.match(/\/(Q\d+)$/)
        if (!qidMatch) continue
        const qid = qidMatch[1]

        let record = byEntity.get(qid)
        if (!record) {
            record = {
                sourceSystem: 'WIKIDATA_CC0',
                licenseSpdx: 'CC0-1.0',
                entityId: qid,
                sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
                fetchedAt,
                label: label.trim(),
                facts: {},
            }
            byEntity.set(qid, record)
        }

        for (const [key, cell] of Object.entries(row)) {
            if (key === 'item' || key === 'itemLabel') continue
            const rawVal = cell?.value?.trim()
            if (!rawVal || /^Q\d+$/.test(rawVal) || rawVal.startsWith('http://www.wikidata.org/')) {
                continue
            }

            const cleanKey = key.replace(/Label$/, '')
            const val = /year|date/i.test(cleanKey)
                ? cleanYear(rawVal) || rawVal
                : rawVal

            const existing = record.facts[cleanKey]
            if (!existing) {
                record.facts[cleanKey] = val
            } else if (Array.isArray(existing)) {
                if (!existing.includes(val) && existing.length < 4) {
                    existing.push(val)
                }
            } else if (existing !== val) {
                record.facts[cleanKey] = [String(existing), val]
            }
        }
    }

    return Array.from(byEntity.values()).filter((r) => Object.keys(r.facts).length >= 2)
}

/**
 * Fetch strictly Public Domain CC0 artworks from The Met Collection API v1.1.
 * Enforces isPublicDomain === true per CC0 clean-room rule.
 */
export async function harvestMetOpenAccess(query: string = 'painting', limit: number = 22): Promise<SourceFactRecord[]> {
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1.1/search?isHighlight=true&isPublicDomain=true&q=${encodeURIComponent(query)}&limit=${limit * 2}`
    const searchResp = await fetch(searchUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(20_000),
    })

    if (!searchResp.ok) {
        throw new Error(`Met API search HTTP ${searchResp.status}`)
    }

    const searchData = (await searchResp.json()) as { objectIDs?: number[] }
    const ids = (searchData.objectIDs || []).slice(0, limit * 2)
    const fetchedAt = new Date().toISOString()
    const records: SourceFactRecord[] = []

    for (const objectId of ids) {
        if (records.length >= limit) break
        try {
            const objResp = await fetch(
                `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`,
                {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(10_000),
                }
            )
            if (!objResp.ok) continue
            const obj = (await objResp.json()) as {
                objectID: number
                isPublicDomain?: boolean
                title?: string
                artistDisplayName?: string
                artistNationality?: string
                objectDate?: string
                medium?: string
                culture?: string
                department?: string
                objectURL?: string
            }

            // STRICT LICENSE GATE: Only accept CC0 public domain artworks
            if (obj.isPublicDomain !== true) continue
            if (!isCleanEnglishLabel(obj.title) || !isCleanEnglishLabel(obj.artistDisplayName)) continue

            const facts: Record<string, string | number | string[]> = {
                artist: obj.artistDisplayName.trim(),
                artworkTitle: obj.title.trim(),
            }
            if (obj.artistNationality) facts.artistNationality = obj.artistNationality.trim()
            if (obj.objectDate) facts.artworkDate = obj.objectDate.trim()
            if (obj.medium) facts.medium = obj.medium.trim()
            if (obj.culture) facts.culture = obj.culture.trim()
            if (obj.department) facts.department = obj.department.trim()

            records.push({
                sourceSystem: 'MET_OPEN_ACCESS_CC0',
                licenseSpdx: 'CC0-1.0',
                entityId: `met:${obj.objectID}`,
                sourceUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
                fetchedAt,
                label: obj.artistDisplayName.trim(),
                facts,
            })
        } catch {
            // Skip transient single-object fetch errors
        }
    }

    return records
}

/**
 * Fetch strictly Public Domain classic literature metadata from Project Gutenberg via Gutendex.
 * Filters strictly to pre-1928 authors (death_year <= 1928) to guarantee US public domain status
 * and strips any Project Gutenberg trademark/boilerplate text.
 */
export async function harvestGutenbergPublicDomain(limit: number = 25): Promise<SourceFactRecord[]> {
    let resp: Response | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
        resp = await fetch('https://gutendex.com/books/?author_year_end=1928&languages=en&sort=popular', {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(20_000),
        })
        if (resp.ok) break
        await new Promise((r) => setTimeout(r, 1500))
    }

    if (!resp || !resp.ok) {
        throw new Error(`Gutendex HTTP ${resp?.status ?? 'network_error'}`)
    }

    const data = (await resp.json()) as {
        results?: Array<{
            id: number
            title?: string
            authors?: Array<{ name?: string; birth_year?: number | null; death_year?: number | null }>
            subjects?: string[]
            copyright?: boolean | null
        }>
    }

    const fetchedAt = new Date().toISOString()
    const records: SourceFactRecord[] = []

    for (const book of data.results || []) {
        if (records.length >= limit) break
        if (book.copyright !== false) continue
        const author = book.authors?.[0]
        if (!author?.name || !author.death_year || author.death_year > 1928) continue
        if (!book.title) continue

        const cleanTitle = book.title
            .replace(/project gutenberg/gi, '')
            .split(';')[0]
            .split(':')[0]
            .trim()
        if (!isCleanEnglishLabel(cleanTitle)) continue

        const authorName = author.name.includes(',')
            ? author.name
                .split(',')
                .map((s) => s.trim())
                .reverse()
                .join(' ')
            : author.name.trim()

        const cleanSubjects = (book.subjects || [])
            .map((s) => s.replace(/\s*--\s*/g, ' - ').trim())
            .filter((s) => s.length < 60 && !/gutenberg/i.test(s))
            .slice(0, 3)

        records.push({
            sourceSystem: 'PROJECT_GUTENBERG_PD',
            licenseSpdx: 'Public-Domain',
            entityId: `pg:${book.id}`,
            sourceUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
            fetchedAt,
            label: cleanTitle,
            facts: {
                author: authorName,
                ...(author.birth_year ? { authorBirthYear: author.birth_year } : {}),
                ...(author.death_year ? { authorDeathYear: author.death_year } : {}),
                ...(cleanSubjects.length > 0 ? { subjects: cleanSubjects } : {}),
            },
        })
    }

    return records
}

/**
 * Fetch strictly CC0 core entity metadata from MusicBrainz API.
 * NEVER reads tags, annotations, or ratings (which are CC BY-NC-SA).
 */
export async function harvestMusicBrainzCore(artistQueries: string[]): Promise<SourceFactRecord[]> {
    const fetchedAt = new Date().toISOString()
    const records: SourceFactRecord[] = []

    for (const query of artistQueries) {
        try {
            const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(`artist:"${query}"`)}&fmt=json&limit=1`
            const resp = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(15_000),
            })
            if (!resp.ok) continue

            const data = (await resp.json()) as {
                artists?: Array<{
                    id: string
                    name?: string
                    type?: string
                    country?: string
                    area?: { name?: string }
                    'begin-area'?: { name?: string }
                    'life-span'?: { begin?: string; end?: string }
                    disambiguation?: string
                }>
            }

            const artist = data.artists?.[0]
            if (!artist?.id || !isCleanEnglishLabel(artist.name)) continue

            // Core CC0 fields ONLY — explicitly ignoring tags, ratings, annotations
            const facts: Record<string, string | number | string[]> = {}
            if (artist.type) facts.artistType = artist.type
            if (artist.area?.name) facts.countryOrArea = artist.area.name
            if (artist['begin-area']?.name) facts.originCity = artist['begin-area'].name
            if (artist['life-span']?.begin) facts.activeOrBorn = artist['life-span'].begin.slice(0, 4)
            if (artist['life-span']?.end) facts.endedOrDied = artist['life-span'].end.slice(0, 4)
            if (artist.disambiguation) facts.disambiguation = artist.disambiguation

            if (Object.keys(facts).length < 2) continue

            records.push({
                sourceSystem: 'MUSICBRAINZ_CORE_CC0',
                licenseSpdx: 'CC0-1.0',
                entityId: `mb:${artist.id}`,
                sourceUrl: `https://musicbrainz.org/artist/${artist.id}`,
                fetchedAt,
                label: artist.name.trim(),
                facts,
            })

            await new Promise((r) => setTimeout(r, 1050))
        } catch {
            // Continue on transient rate-limit or network hiccup
        }
    }

    return records
}

/**
 * Batch-enrich Wikidata CC0 records via MediaWiki wbgetentities API (100% CC0-1.0).
 * Extracts vivid, storytelling structured properties (aliases, nicknames, characters,
 * narrative settings, bodies of water, notable works, awards, depictions, movements,
 * authors, composers, burial places, founders) so the writer crafts rich quiz-show
 * clues instead of bare 3-column database dumps.
 */
const ENRICHMENT_PROPS: Record<string, string> = {
    P1449: 'nickname',
    P180: 'depicts',
    P674: 'characters',
    P144: 'basedOn',
    P800: 'notableWork',
    P166: 'awards',
    P206: 'locatedNearWater',
    P403: 'flowsInto',
    P135: 'movement',
    P119: 'burialPlace',
    P112: 'foundedBy',
    P159: 'headquarters',
    P921: 'mainSubject',
    P186: 'madeFrom',
    P138: 'namedAfter',
    P50: 'author',
    P86: 'composer',
    P57: 'director',
    P161: 'castMember',
    P607: 'conflict',
    P1451: 'motto',
    P170: 'creator',
}

interface WbClaim {
    mainsnak?: {
        datatype?: string
        datavalue?: {
            type?: string
            value?: unknown
        }
    }
}

interface WbEntity {
    id: string
    labels?: { en?: { value?: string } }
    aliases?: { en?: Array<{ value?: string }> }
    descriptions?: { en?: { value?: string } }
    claims?: Record<string, WbClaim[]>
}

export async function enrichWikidataRecords(records: SourceFactRecord[]): Promise<SourceFactRecord[]> {
    const wdRecords = records.filter((r) => r.sourceSystem === 'WIKIDATA_CC0' && /^Q\d+$/.test(r.entityId))
    if (wdRecords.length === 0) return records

    const chunkSize = 40
    const entityMap = new Map<string, WbEntity>()
    const referencedQids = new Set<string>()

    // Pass 1: Fetch entities + claims in batches of 40
    for (let i = 0; i < wdRecords.length; i += chunkSize) {
        const batch = wdRecords.slice(i, i + chunkSize)
        const ids = batch.map((r) => r.entityId).join('|')
        const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}&languages=en&props=labels|aliases|descriptions|claims&format=json`
        try {
            const resp = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(20_000),
            })
            if (!resp.ok) continue
            const data = (await resp.json()) as { entities?: Record<string, WbEntity> }
            for (const [qid, ent] of Object.entries(data.entities || {})) {
                entityMap.set(qid, ent)
                const claims = ent.claims || {}
                for (const propId of Object.keys(ENRICHMENT_PROPS)) {
                    const statements = (claims[propId] || []).slice(0, 3)
                    for (const st of statements) {
                        const dv = st.mainsnak?.datavalue
                        if (dv?.type === 'wikibase-entityid') {
                            const val = dv.value as { id?: string }
                            if (val?.id && /^Q\d+$/.test(val.id)) {
                                referencedQids.add(val.id)
                            }
                        }
                    }
                }
            }
            await new Promise((r) => setTimeout(r, 200))
        } catch {
            // Non-fatal: keep existing harvested facts
        }
    }

    // Pass 2: Resolve referenced QIDs to English labels in batches of 50
    const labelMap = new Map<string, string>()
    const refList = Array.from(referencedQids)
    for (let i = 0; i < refList.length; i += 50) {
        const batch = refList.slice(i, i + 50).join('|')
        const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch}&languages=en&props=labels&format=json`
        try {
            const resp = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(15_000),
            })
            if (!resp.ok) continue
            const data = (await resp.json()) as { entities?: Record<string, WbEntity> }
            for (const [qid, ent] of Object.entries(data.entities || {})) {
                const lbl = ent.labels?.en?.value?.trim()
                if (lbl) labelMap.set(qid, lbl)
            }
            await new Promise((r) => setTimeout(r, 150))
        } catch {
            // Non-fatal
        }
    }

    // Pass 3: Merge enriched CC0 facts + aliases into each record
    for (const rec of wdRecords) {
        const ent = entityMap.get(rec.entityId)
        if (!ent) continue

        const aliases = (ent.aliases?.en || [])
            .map((a) => a.value?.trim())
            .filter((v): v is string => Boolean(v && v.length >= 2 && v.length <= 45))
            .slice(0, 4)
        if (aliases.length > 0) {
            rec.aliases = Array.from(new Set([...(rec.aliases || []), ...aliases]))
        }

        const claims = ent.claims || {}
        for (const [propId, fieldName] of Object.entries(ENRICHMENT_PROPS)) {
            if (rec.facts[fieldName]) continue
            const statements = (claims[propId] || []).slice(0, 3)
            const values: string[] = []
            for (const st of statements) {
                const dv = st.mainsnak?.datavalue
                if (!dv) continue
                if (dv.type === 'wikibase-entityid') {
                    const id = (dv.value as { id?: string })?.id
                    const resolved = id ? labelMap.get(id) : undefined
                    if (resolved && !values.includes(resolved)) values.push(resolved)
                } else if (dv.type === 'monolingualtext') {
                    const txt = (dv.value as { text?: string; language?: string })
                    if (txt?.text && (!txt.language || txt.language === 'en') && txt.text.length <= 80) {
                        if (!values.includes(txt.text)) values.push(txt.text)
                    }
                } else if (dv.type === 'string' && typeof dv.value === 'string' && dv.value.length <= 60) {
                    if (!values.includes(dv.value)) values.push(dv.value)
                }
            }
            if (values.length === 1) {
                rec.facts[fieldName] = values[0]
            } else if (values.length > 1) {
                rec.facts[fieldName] = values
            }
        }
    }

    return records
}

/**
 * Execute a HarvestRecipe and return structured CC0/PD FactRecords.
 */
export async function executeHarvestRecipe(recipe: HarvestRecipe): Promise<SourceFactRecord[]> {
    switch (recipe.sourceSystem) {
        case 'WIKIDATA_CC0': {
            if (!recipe.sparql) throw new Error(`Missing SPARQL for recipe ${recipe.id}`)
            const res = await harvestWikidataSparql(recipe.sparql)
            await new Promise((r) => setTimeout(r, 350)) // Polite Wikidata throttle
            return await enrichWikidataRecords(res)
        }
        case 'MET_OPEN_ACCESS_CC0':
            return await harvestMetOpenAccess(recipe.metQuery || 'painting')
        case 'PROJECT_GUTENBERG_PD':
            return await harvestGutenbergPublicDomain()
        case 'MUSICBRAINZ_CORE_CC0':
            return await harvestMusicBrainzCore(recipe.musicbrainzQueries || [])
    }
}

/**
 * Build a code-verified wordplay FactBundle by filtering already-harvested CC0 records
 * against a deterministic letter/length rule.
 */
export function buildWordplayBundle(params: {
    records: SourceFactRecord[]
    rule: WordplayRule
    knowledgeCategory: KnowledgeCategory
    round: JeopardyRound
    themeHint: string
}): FactBundle | null {
    const matching = params.records.filter((r) => verifyWordplayRule(r.label, params.rule))
    const seen = new Set<string>()
    const unique = matching.filter((r) => {
        const key = r.label.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })

    if (unique.length < 7) {
        return null
    }

    return {
        bundleId: `wp-${crypto.randomUUID().slice(0, 8)}`,
        knowledgeCategory: params.knowledgeCategory,
        round: params.round,
        archetype: 'WORDPLAY_LETTER_RULE',
        themeHint: `${params.themeHint} — STRICT WORDPLAY RULE: ${params.rule.description}`,
        wordplayRule: params.rule,
        records: unique.slice(0, 16),
        harvestedAt: new Date().toISOString(),
    }
}

/**
 * Construct a scoped FactBundle from harvested records.
 */
export function createFactBundle(params: {
    knowledgeCategory: KnowledgeCategory
    round: JeopardyRound
    archetype: CategoryArchetype
    themeHint: string
    records: SourceFactRecord[]
    wordplayRule?: WordplayRule
}): FactBundle {
    return {
        bundleId: `fb-${crypto.randomUUID().slice(0, 8)}`,
        knowledgeCategory: params.knowledgeCategory,
        round: params.round,
        archetype: params.archetype,
        themeHint: params.themeHint,
        wordplayRule: params.wordplayRule,
        records: params.records,
        harvestedAt: new Date().toISOString(),
    }
}
