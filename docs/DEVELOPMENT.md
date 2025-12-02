# Trivrdy Development Guide

This guide covers advanced development topics. For quick start, see the [main README](../README.md).

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (with pgvector extension)
- Docker (optional, for containerized development)
- OpenAI API key (for semantic category inference - optional but recommended)

## Development Setup

### Local Development (Recommended)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 3. Start database
docker compose up -d db

# 4. Initialize database
npm run db:setup

# 5. Start dev server
npm run dev
```

### Docker Development (with hot-reloading)

```bash
# Start everything in Docker
npm run dev:docker

# Rebuild if needed
npm run dev:docker:build

# Stop when done
npm run dev:docker:down
```

**Note:** Docker development mounts your source code, so changes are reflected immediately. Only database migrations require a rebuild.

## Environment Variables

Create `.env.local` for local development:

```env
# Database (use 'localhost' for local, 'db' for Docker)
DATABASE_URL="postgresql://user:password@localhost:5432/trivrdy?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/trivrdy?schema=public"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Admin Configuration
ADMIN_EMAILS="admin@example.com"

# OpenAI (for embeddings)
OPENAI_API_KEY="sk-..."
```

## Database Management

### Initial Setup

```bash
npm run db:setup
```

This runs:
1. `db:generate` - Generate Prisma client
2. `db:migrate` - Run migrations
3. `db:create-indexes` - Create vector indexes
4. `db:seed:embeddings` - Seed knowledge category embeddings

### Making Schema Changes

```bash
# 1. Edit prisma/schema.prisma
# 2. Create and apply migration
npm run db:migrate:dev

# 3. Prisma client auto-regenerates
```

### Seeding Data

```bash
# Seed questions from JSON files
npm run db:seed

# Seed knowledge category embeddings (requires OpenAI key)
npm run db:seed:embeddings

# Fetch recent questions from J-Archive
npm run db:fetch

# Backfill historical questions
npm run db:backfill -- --start-date 2024-01-01 --end-date 2024-12-31
```

### Database Commands Reference

| Command | Description |
|---------|-------------|
| `db:setup` | Complete initial setup |
| `db:generate` | Generate Prisma client |
| `db:migrate` | Run migrations (production) |
| `db:migrate:dev` | Create and run migrations (development) |
| `db:reset` | Reset database (⚠️ deletes all data) |
| `db:push` | Push schema without migrations (dev only) |
| `db:seed` | Seed question data |
| `db:seed:embeddings` | Seed category embeddings |
| `db:create-indexes` | Create vector indexes |
| `db:fetch` | Fetch recent questions |
| `db:backfill` | Backfill historical questions |

## Vector Embeddings

Trivrdy uses OpenAI's `text-embedding-3-small` model with pgvector for semantic search.

### How It Works

1. **Reference Embeddings**: Created for each knowledge category description
2. **Question Embeddings**: Generated when questions are imported
3. **Category Inference**: Cosine similarity determines the best matching category
4. **Confidence Threshold**: 0.3 prevents misclassification

### Knowledge Categories

- `GEOGRAPHY_AND_HISTORY` - Geography, world history, civilizations
- `ENTERTAINMENT` - Movies, TV, music, pop culture
- `ARTS_AND_LITERATURE` - Books, art, theater, classical music
- `SCIENCE_AND_NATURE` - Science, biology, nature, technology
- `SPORTS_AND_LEISURE` - Sports, games, hobbies
- `GENERAL_KNOWLEDGE` - Miscellaneous trivia

## Answer Checking

The answer checker (`src/lib/answer-checker.ts`) uses intelligent matching to accept reasonable variations.

### Normalization Rules

- **Case insensitive**: "PARIS" = "paris" = "Paris"
- **Accents normalized**: "café" = "cafe"
- **Hyphens/spaces equivalent**: "cray-cray" = "cray cray"
- **Punctuation ignored**: "paris!" = "paris"
- **Leading articles stripped**: "the Eiffel Tower" = "Eiffel Tower"
- **Optional question phrasing**: "What is Paris" = "Paris"

### Fuzzy Matching

Uses phonetic algorithms (Double Metaphone) and Jaro-Winkler similarity with length-based thresholds:

- **Very short (≤3 chars)**: Strict matching required
- **Short (4-5 chars)**: Phonetic match or ≥0.92 similarity
- **Medium (6-8 chars)**: Phonetic match or ≥0.88 similarity
- **Long (9+ chars)**: Phonetic match or ≥0.85 similarity
- **Multi-word**: 80% of words must match

See `src/lib/answer-checker.test.ts` for examples.

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
│   │   ├── answer-checker.ts
│   │   ├── embeddings.ts
│   │   ├── prisma.ts
│   │   └── ...
│   └── scripts/             # CLI scripts
│       ├── seed-database.ts
│       ├── seed-knowledge-embeddings.ts
│       └── backfill-jarchive.ts
├── docker-compose.yml       # Production Docker setup
├── docker-compose.dev.yml   # Development Docker setup
└── Dockerfile.dev           # Development Dockerfile
```

## Testing

```bash
# Watch mode
npm run test

# Single run
npm run test:run
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

**Local development:**
- Check that DATABASE_URL uses `localhost:5432`
- Ensure database is running: `docker compose up -d db`

**Docker development:**
- Check that DATABASE_URL uses `db:5432`
- Ensure both containers are running: `docker compose ps`

### Migration issues

**Local development:**
```bash
# Reset and re-run migrations
npm run db:reset
npm run db:setup
```

**Docker development:**
Migrations run automatically when containers start via the entrypoint script. The script:
1. Waits for the database to be ready
2. Runs `prisma migrate deploy` to apply pending migrations
3. Regenerates the Prisma client
4. Starts the application

If you need to create new migrations in Docker:
```bash
# Run migrations manually inside the container
docker compose exec web npm run db:migrate:dev
```

**Production:**
Migrations run automatically on container startup using `prisma migrate deploy`. This is safe for production as it only applies existing migrations and doesn't create new ones.

### Prisma client out of sync

```bash
npm run db:generate
```

### Docker command not found

On macOS, Docker might not be in your PATH. Use the full path:

```bash
/Applications/Docker.app/Contents/Resources/bin/docker compose up -d db
```

Or add Docker to your PATH (see shell configuration).

## Code Quality

```bash
# Run all checks
npm run validate

# Individual checks
npm run lint
npm run typecheck
```

## Common Workflows

### Adding a new feature

1. Create feature branch
2. Make code changes
3. Update schema if needed: `npm run db:migrate:dev`
4. Test locally: `npm run dev`
5. Run checks: `npm run validate`
6. Commit and push

### Updating question data

```bash
# Fetch recent questions
npm run db:fetch

# Or backfill specific date range
npm run db:backfill -- --start-date 2024-01-01 --end-date 2024-12-31
```

### Deploying to production

1. Run migrations: `npm run db:migrate`
2. Build: `npm run build`
3. Test build: `npm run start`
4. Deploy (Vercel/Railway/etc.)
