# trivrdy - Study Jeopardy Online

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)](https://www.prisma.io/)
[![pgvector](https://img.shields.io/badge/pgvector-Embeddings-orange)](https://github.com/pgvector/pgvector)

trivrdy is a modern, interactive Jeopardy study platform that helps you improve your trivia knowledge through authentic Jeopardy questions. Practice at your own pace or challenge yourself with full game simulations.

## 🚀 Quick Start

### Option 1: Local Development (Recommended for most developers)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables (copy .env.example to .env.local)
# See Environment Variables section below

# 3. Start database with Docker
docker compose up -d db

# 4. Set up database (migrations, indexes, embeddings)
npm run db:setup

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 2: Full Docker Development (with hot-reloading)

```bash
# 1. Install dependencies locally (for IDE support)
npm install

# 2. Set up environment variables
# Copy .env.example to .env.local

# 3. Start everything with Docker (includes hot-reloading)
npm run dev:docker

# Or rebuild containers if needed
npm run dev:docker:build
```

**Stop Docker:** `npm run dev:docker:down`

## 📋 Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** 14+ with pgvector extension (or Docker)
- **Docker** (optional, for containerized development)
- **OpenAI API key** (for semantic embeddings - optional but recommended)

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database (use localhost for local dev, 'db' for Docker)
DATABASE_URL="postgresql://user:password@localhost:5432/trivrdy?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/trivrdy?schema=public"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Admin Configuration (comma-separated emails)
ADMIN_EMAILS="admin@example.com,another@example.com"

# OpenAI (for semantic category inference)
OPENAI_API_KEY="sk-..."

# Optional: For production builds
NODE_ENV="development"
```

**Note:** For Docker development, use `db` as the hostname instead of `localhost` in your `.env` file (Docker Compose will handle the connection).

## 📦 Available Commands

### Development

```bash
npm run dev              # Start local dev server (localhost:3000)
npm run dev:docker       # Start dev server in Docker with hot-reloading
npm run dev:docker:build # Rebuild and start Docker dev environment
npm run dev:docker:down  # Stop Docker dev environment
```

### Database

```bash
npm run db:setup         # Complete setup: generate client, migrate, create indexes, seed embeddings
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run pending migrations (production)
npm run db:migrate:dev   # Create and run migrations (development)
npm run db:reset         # Reset database (⚠️ deletes all data)
npm run db:push          # Push schema changes without migrations (dev only)
npm run db:seed          # Seed question data from JSON files
npm run db:seed:embeddings  # Seed knowledge category embeddings (requires OpenAI key)
npm run db:create-indexes   # Create vector indexes for semantic search
```

### Data Management

```bash
npm run db:fetch              # Fetch recent questions from J-Archive
npm run db:backfill           # Backfill historical questions (see docs for options)
npm run db:update-triple-stumpers  # Update triple stumper flags
```

### Build & Production

```bash
npm run build            # Build for production
npm run start            # Start production server
```

### Code Quality

```bash
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript type checking
npm run validate         # Run both lint and typecheck
npm run test             # Run tests in watch mode
npm run test:run         # Run tests once
```

## 🎮 Game Modes

### Classic Game Mode
- Complete Jeopardy board simulation
- Six categories with five questions each
- Authentic scoring system
- Real questions from past Jeopardy episodes

### Practice Mode
- Focus on specific knowledge categories
- Track your progress and statistics
- Personalized question recommendations
- Spaced repetition learning
- Custom difficulty settings

## 📊 Features

- **Smart Answer Validation**: Intelligent answer checking that understands variations and common alternatives
- **Knowledge Categories**: Questions organized by subject area (History, Science, Arts, etc.)
- **Semantic Category Inference**: Uses pgvector embeddings to automatically categorize questions
- **Progress Tracking**: Detailed statistics and performance analytics
- **Spoiler Protection**: Built-in system to avoid questions from recent episodes
- **Responsive Design**: Optimized for both desktop and mobile play
- **User Profiles**: Customizable avatars and display names
- **Leaderboards**: Compete with other players globally
- **Clerk Authentication**: Modern auth with magic links and OAuth

## 🛠 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS with custom theming
- **Authentication**: Clerk
- **Database**: PostgreSQL with Prisma ORM
- **Vector Search**: pgvector for semantic embeddings
- **State Management**: React Query
- **Hosting**: Any Node.js host (Vercel, Railway, Fly.io, self-hosted)

## 🔧 Development Workflow

### First Time Setup

1. **Clone and install:**
   ```bash
   git clone <repo-url>
   cd jeopardy
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

3. **Start database:**
   ```bash
   docker compose up -d db
   ```

4. **Initialize database:**
   ```bash
   npm run db:setup
   ```

5. **Start development:**
   ```bash
   npm run dev
   ```

### Daily Development

```bash
# Start database (if not running)
docker compose up -d db

# Start dev server
npm run dev

# Make changes - hot reloading is automatic!
```

### Making Schema Changes

```bash
# 1. Edit prisma/schema.prisma
# 2. Create migration
npm run db:migrate:dev

# 3. Regenerate Prisma client (auto-runs, but you can manually run)
npm run db:generate
```

### Adding New Questions

```bash
# Fetch recent questions
npm run db:fetch

# Or backfill historical data
npm run db:backfill -- --start-date 2024-01-01 --end-date 2024-12-31
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy!

### Self-Hosted with Docker

```bash
# Build and start production containers
docker compose up -d

# Or build manually
npm run build
npm run start
```

Requires:
- PostgreSQL with pgvector
- Node.js 18+
- Reverse proxy (nginx/caddy) for HTTPS

## 📚 Additional Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Detailed development information
- [Answer Checking Rules](docs/DEVELOPMENT.md#answer-checking-rules) - How answer validation works
- [Vector Embeddings](docs/DEVELOPMENT.md#vector-embeddings) - Semantic search implementation

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Tucker Craig**
- Website: [tuckercraig.com](https://tuckercraig.com)
- Twitter: [@btuckerc](https://twitter.com/btuckerc)
- BlueSky: [@btuckerc.com](https://bsky.app/profile/btuckerc.com)

## 🙏 Acknowledgments

- Built with data from J! Archive
- Special thanks to the Jeopardy community
- Inspired by the classic game show format

---

*Note: This is not affiliated with Jeopardy! or Sony Pictures Television*
