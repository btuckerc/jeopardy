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

### Database Backups

The project includes a backup script for creating point-in-time snapshots of the production database.

#### Manual Backup

```bash
# Create a backup
./scripts/backup-database.sh

# Create a backup and keep only the 5 most recent
./scripts/backup-database.sh --keep 5
```

Backups are saved to `backups/trivrdy_backup_YYYYMMDD_HHMMSS.sql` with:
- Full schema (tables, indexes, constraints)
- All data
- `--clean --if-exists` flags for safe restores

#### Automated Weekly Backups (macOS)

To enable automatic weekly backups using macOS launchd:

```bash
# 1. Install the launch agent
cp scripts/com.trivrdy.backup.plist ~/Library/LaunchAgents/

# 2. Load the agent (starts the schedule)
launchctl load ~/Library/LaunchAgents/com.trivrdy.backup.plist

# 3. Verify it's loaded
launchctl list | grep trivrdy
```

The agent runs every **Sunday at 3:00 AM** and keeps the 8 most recent backups (2 months).

**Managing the backup schedule:**

```bash
# Check status
launchctl list | grep trivrdy

# Run backup manually (test the schedule)
launchctl start com.trivrdy.backup

# Stop scheduled backups
launchctl unload ~/Library/LaunchAgents/com.trivrdy.backup.plist

# View logs
tail -f backups/backup.log
tail -f backups/launchd-stdout.log
```

#### Restoring from Backup

⚠️ **Warning**: Restoring will replace all existing data. Create a fresh backup first if needed.

```bash
# Restore from a backup file (container must be running)
docker exec -i jeopardy-db-1 psql -U trivrdy -d trivrdy < backups/trivrdy_backup_YYYYMMDD_HHMMSS.sql

# Example with a specific backup
docker exec -i jeopardy-db-1 psql -U trivrdy -d trivrdy < backups/trivrdy_backup_20260204_075652.sql
```

After restoring:
1. Verify the data: `docker exec jeopardy-db-1 psql -U trivrdy -d trivrdy -c "SELECT COUNT(*) FROM \"Question\""`
2. Restart the web container to clear any caches: `docker restart jeopardy-web-1`

#### Backup File Location

Backups are stored in the `backups/` directory (git-ignored). The backup script creates:
- `trivrdy_backup_YYYYMMDD_HHMMSS.sql` - The database dump
- `backup.log` - Backup operation logs

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

## Display Name Generation

The application automatically generates on-brand display names for new users using a curated adjective+noun combination system.

### Naming Scheme

- **Format**: Concatenated adjective + noun (e.g., "QuickScholar", "BrightThinker")
- **Length**: 3-20 characters (enforced by validation)
- **Style**: On-brand vocabulary focused on trivia, knowledge, thinking, and game-show themes
- **No Numbers**: Names do not include numeric suffixes by default (can be enabled if needed at scale)

### Word Lists

The generator uses two curated lists:
- **Adjectives** (170 items): Intelligence/knowledge terms (Quick, Clever, Bright, Sharp, Smart, Precise, Accurate, Focused, etc.), enthusiasm terms (Eager, Bold, Brisk, Dynamic, Energetic), achievement terms (Grand, Prime, Elite, Outstanding, Remarkable), thinking terms (Deep, Rich, Vast, Profound), game-show appropriate terms (Lucky, Swift, Fast, Competitive, Driven), and positive traits (Cool, Great, Excellent, Marvelous, Splendid)
- **Nouns** (160 items): Knowledge/learning terms (Scholar, Thinker, Master, Expert, Genius, Guru, Mentor, Teacher, etc.), achievement terms (Champion, Winner, Victor, Hero, Fighter, Warrior), thinking/intelligence terms (Solver, Cracker, Decoder, Analyst, Detective, Strategist), game-show appropriate terms (Player, Contestant, Answerer, Responder, Gamer), and knowledge domains (Quizzer, History, Science, Math, Art, Music, Literature)

### Uniqueness Guarantees

- **Soft Uniqueness**: Enforced at the application layer, not at the database level
- **Collision Detection**: The `generateUniqueDisplayName()` helper checks for existing names (case-insensitive) and retries up to 50 times
- **Collision Logging**: All collisions are logged for observability, with warnings when approaching retry limits
- **Race Conditions**: Under extreme race conditions, duplicates could theoretically occur, but this is extremely unlikely with the expanded word lists
- **Name Pool Size**: **57,404 unique combinations** (254 adjectives × 226 nouns) - sufficient for a very large playerbase with minimal collision risk. Words are curated to be natural and appropriate for trivia game usernames.

### Usage

**New User Creation** (`src/lib/clerk-auth.ts`):
- Automatically generates a unique display name when a new user signs up via Clerk
- Uses `generateUniqueDisplayName()` to ensure uniqueness

**Admin Reset** (`src/app/api/admin/users/[userId]/route.ts`):
- Admin can reset a user's display name to a new random unique name
- Uses the same uniqueness helper with `excludeUserId` to avoid conflicts

**Display Fallback** (`src/app/api/user/display-name/route.ts`):
- GET endpoint uses `generateRandomDisplayName()` as an ephemeral fallback if no stored name exists
- This is non-persisted and may duplicate existing names (acceptable for display-only purposes)

### Extending Word Lists

To add new words to the generator:

1. **Edit `src/lib/display-name.ts`**:
   - Add words to `DISPLAY_NAME_ADJECTIVES` or `DISPLAY_NAME_NOUNS` arrays
   - Ensure words fit within 20-character limit when combined
   - Run words through `validateDisplayName()` to ensure they pass profanity/reserved checks

2. **Validation**:
   - All generated names automatically pass through `validateDisplayName()` which checks:
     - Length (3-20 chars)
     - Character set (letters, numbers, spaces, `.`, `_`, `-`)
     - Profanity filtering (badwords-list + pattern-based fallback)
     - Reserved names (admin, moderator, jeopardy, etc.)
     - Spam patterns (excessive repetition, all numbers, etc.)

3. **Testing**:
   - Generate a sample of names and verify they're on-brand
   - Check that collision rates remain low with expanded lists
   - Monitor collision logs in production to ensure word space is sufficient

### Future Hardening Options

If the playerbase grows very large and collision rates become problematic:

1. **Optional Suffix Mode**: Add a configurable letters-only suffix (e.g., 3-letter code) to dramatically increase the name space
2. **Database Unique Index**: Add a case-insensitive unique index on `displayName` for hard uniqueness guarantees (requires migration)
3. **Hybrid Approach**: Use suffixes only when collision rates exceed a threshold

### Observability

- **Collision Logging**: All collisions are logged with attempt counts
- **Warning Thresholds**: Warnings emitted when approaching retry limits (indicates word space may need expansion)
- **Error Handling**: Graceful fallback to simple generated name if uniqueness check fails (should be extremely rare)

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

## Naming Conventions

### Study Mode vs Practice Mode

The user-facing feature is called **"Study Mode"**, but internally the codebase uses **"practice"** as a legacy term in:
- URL routes (`/practice/*`)
- API route segments (`/api/practice/*`)
- Database fields and schema (if any)
- Internal variable names and function names

This is intentional to avoid breaking changes. When adding new features or writing new code:
- Use **"study mode"** in user-facing copy, comments, and documentation
- Keep **"practice"** in technical contracts (routes, API paths, database fields) to maintain backwards compatibility

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
│   │   ├── practice/        # Study mode pages (legacy internal name: "practice")
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
