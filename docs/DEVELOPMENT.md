# Trivrdy Development Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (with pgvector extension)
- OpenAI API key (for semantic category inference)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

#### Option A: Local PostgreSQL with Docker (Recommended)

```bash
# Start PostgreSQL with pgvector
docker run -d \
  --name trivrdy-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=trivrdy \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trivrdy"
export DIRECT_URL="postgresql://postgres:postgres@localhost:5432/trivrdy"
```

#### Option B: Supabase Local Development

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Use the connection strings from the output
```

### 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed knowledge category embeddings (requires OPENAI_API_KEY)
npm run db:seed:embeddings

# Seed questions from JSON
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

## Environment Variables

Create a `.env.local` file with the following:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trivrdy"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/trivrdy"

# Supabase (for auth)
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# OpenAI (for semantic category inference)
OPENAI_API_KEY="sk-..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Data Management

### Fetching New Questions from J-Archive

```bash
# Fetch questions for a date range
npm run db:backfill -- --start-date 2024-01-01 --end-date 2024-12-31

# Append to existing data
npm run db:backfill -- --start-date 2024-01-01 --end-date 2024-12-31 --append

# Resume interrupted fetch
npm run db:backfill -- --start-date 2024-01-01 --end-date 2024-12-31 --resume
```

### Seeding the Database

```bash
# Seed from default file (data/jeopardy_questions.json)
npm run db:seed

# Seed from specific file
npm run db:seed -- --file data/big_questions.json

# Dry run (show what would happen)
npm run db:seed -- --dry-run

# Skip embedding-based category inference (faster)
npm run db:seed -- --skip-embeddings

# Clear and reseed (DANGER!)
npm run db:seed -- --clear
```

## Vector Embeddings

Trivrdy uses OpenAI's `text-embedding-3-small` model with pgvector for:

1. **Semantic Category Inference**: Questions are classified into knowledge categories based on semantic similarity, not just keyword matching.

2. **Similar Question Discovery**: Find related questions for practice recommendations.

### How It Works

1. Reference embeddings are created for each knowledge category description
2. When questions are imported, their content is embedded
3. Cosine similarity determines the best matching category
4. Confidence threshold (0.3) prevents misclassification

### Knowledge Categories

- `GEOGRAPHY_AND_HISTORY` - Geography, world history, civilizations
- `ENTERTAINMENT` - Movies, TV, music, pop culture
- `ARTS_AND_LITERATURE` - Books, art, theater, classical music
- `SCIENCE_AND_NATURE` - Science, biology, nature, technology
- `SPORTS_AND_LEISURE` - Sports, games, hobbies
- `GENERAL_KNOWLEDGE` - Miscellaneous trivia

## Project Structure

```
trivrdy/
├── data/                    # Question data files
│   ├── jeopardy_questions.json
│   └── big_questions.json
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   ├── game/            # Game mode pages
│   │   ├── practice/        # Practice mode pages
│   │   └── ...
│   ├── components/          # Shared components
│   ├── lib/                 # Shared utilities
│   │   ├── embeddings.ts    # OpenAI embeddings service
│   │   ├── prisma.ts        # Prisma client
│   │   └── ...
│   └── scripts/             # CLI scripts
│       ├── seed-database.ts
│       ├── seed-knowledge-embeddings.ts
│       └── backfill-jarchive.ts
└── ...
```

## Answer Checking Rules

The answer checker (`src/app/lib/answer-checker.ts`) uses a lenient matching system designed to accept reasonable user input without requiring exact formatting.

### Normalization Rules

1. **Case insensitive**: "PARIS" = "paris" = "Paris"
2. **Accents normalized**: "café" = "cafe", "Bébé" = "bebe"
3. **Hyphens/spaces are equivalent**: "cray-cray" = "cray cray" = "craycray"
4. **Punctuation ignored**: "paris!" = "paris?" = "paris"
5. **Apostrophes ignored**: "don't" = "dont"
6. **Leading articles stripped**: "the Eiffel Tower" = "Eiffel Tower"
7. **Possessive pronouns stripped**: "my dog" = "dog"

### Optional Question Phrasing

Users don't need to type "What is..." - the following are all accepted:
- "Paris"
- "What is Paris"
- "Who is Einstein"
- "Where is France"

### Equivalent Terms

Common abbreviations and alternate names are recognized:
- USA / US / United States / United States of America
- UK / United Kingdom / Great Britain / Britain
- WWI / WW1 / World War 1 / First World War
- WWII / WW2 / World War 2 / Second World War

### Parenthetical Alternatives

Answers like "Abraham Lincoln (or Honest Abe)" accept both:
- "Abraham Lincoln"
- "Honest Abe"

### List Answers

For list-type answers, items can be in any order:
- "salt and pepper" = "pepper and salt"
- "salt & pepper" = "salt and pepper"

### Fuzzy Matching

The answer checker uses a **phonetic-primary** approach with multiple safeguards:

1. **Double Metaphone**: Industry-standard phonetic algorithm that handles words with multiple pronunciations
2. **Jaro-Winkler similarity**: Better than Levenshtein for short strings, gives bonus for matching prefixes
3. **Phonetic normalization**: Pre-processes common respellings (ph→f, ght→t, ay→e for accented é)
4. **Anagram detection**: Rejects answers with same letters rearranged (but allows transposition typos)
5. **First-character matching**: Phonetic first-char for longer words, literal for short words

**Matching rules by word length:**
- **Very short words (≤3 chars)**: Strict - require literal first char match + phonetic match + high similarity
- **Short words (4-5 chars)**: Phonetic match with phonetic first-char match, or very high Jaro-Winkler (≥0.92)
- **Medium words (6-8 chars)**: Phonetic match with first-char match, or Jaro-Winkler ≥0.88
- **Long words (9+ chars)**: Phonetic match with first-char match, or Jaro-Winkler ≥0.85
- **Multi-word answers (3+ words)**: 80% of words must match

**Examples that MATCH:**
- "fone" = "phone" (phonetic respelling)
- "kolor" = "color" (k/c are phonetically equivalent)
- "abby" = "abbey" (high Jaro-Winkler: 0.95)
- "baybay" = "Bébé" (phonetic normalization: ay→e)
- "recieve" = "receive" (transposition typo allowed)
- "Westminster Abby" = "Westminster Abbey"

**Examples that DON'T match:**
- "iko iko" ≠ "oki oki" (anagram - same letters rearranged)
- "dog" ≠ "dig" (same phonetic code but low similarity)
- "god" ≠ "dog" (anagram)
- "cat" ≠ "car" (different words)
- "eb" ≠ "er" (too short, different sounds)

### Running Tests

```bash
npm run test        # Watch mode
npm run test:run    # Single run
```

## Troubleshooting

### "pgvector extension not found"

Make sure you're using a PostgreSQL image with pgvector:

```bash
docker pull pgvector/pgvector:pg16
```

### "OPENAI_API_KEY not set"

The app will fall back to pattern-based category inference, but results will be less accurate. Set your API key for best results.

### Database connection issues

Check that your DATABASE_URL is correct and the database is running:

```bash
# Test connection
npx prisma db pull
```

### Migration issues

Reset and re-run migrations:

```bash
npm run db:reset
npm run db:setup
```

