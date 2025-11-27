# trivrdy - Study Jeopardy Online

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC)](https://tailwindcss.com/)
[![NextAuth.js](https://img.shields.io/badge/NextAuth.js-5-purple)](https://authjs.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)](https://www.prisma.io/)
[![pgvector](https://img.shields.io/badge/pgvector-Embeddings-orange)](https://github.com/pgvector/pgvector)

trivrdy is a modern, interactive Jeopardy study platform that helps you improve your trivia knowledge through authentic Jeopardy questions. Practice at your own pace or challenge yourself with full game simulations.

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
- **Self-Hosted Auth**: No external auth dependencies - uses NextAuth.js with magic links

## 🛠 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS with custom theming
- **Authentication**: NextAuth.js (self-hosted, magic links + OAuth)
- **Database**: PostgreSQL with Prisma ORM
- **Vector Search**: pgvector for semantic embeddings
- **State Management**: React Query
- **Hosting**: Any Node.js host (Vercel, Railway, Fly.io, self-hosted)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- OpenAI API key (for embeddings)
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/trivrdy.git
cd trivrdy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (create `.env`):
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/trivrdy?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/trivrdy?schema=public"

# NextAuth.js
AUTH_SECRET="your-random-secret-at-least-32-chars"  # Generate with: openssl rand -base64 32
AUTH_URL="http://localhost:3000"

# Email (for magic links) - Optional, use OAuth if not configured
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="your-email@example.com"
EMAIL_SERVER_PASSWORD="your-email-password"
EMAIL_FROM="noreply@trivrdy.com"

# OAuth Providers (Optional)
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# OpenAI (for embeddings)
OPENAI_API_KEY="sk-..."
```

4. Set up PostgreSQL with pgvector:
```bash
# Using Docker (recommended)
docker run -d --name trivrdy-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=trivrdy \
  -p 5432:5432 \
  ankane/pgvector:latest
```

5. Initialize the database:
```bash
npm run db:setup
```

This will:
- Generate Prisma client
- Run database migrations
- Create HNSW vector indexes
- Seed knowledge category embeddings
- Seed initial question data

6. Start development server:
```bash
npm run dev
```

## 📦 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run dev:prod         # Start dev server with production env
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript checks
npm run validate         # Run all checks

# Database
npm run db:setup         # Complete database setup
npm run db:reset         # Reset database (caution!)
npm run db:migrate       # Run migrations
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes (dev only)
npm run db:seed          # Seed question data
npm run db:seed:embeddings  # Seed knowledge category embeddings
npm run db:create-indexes   # Create HNSW vector indexes

# Data Ingestion
npm run db:fetch         # Fetch new questions from J-Archive
npm run db:backfill      # Backfill historical questions
```

## 🔧 Database Schema

The app uses PostgreSQL with pgvector for semantic search:

- **User**: Authentication and profile data (NextAuth.js compatible)
- **Question**: Jeopardy questions with vector embeddings
- **Category**: Question categories with embeddings
- **KnowledgeCategoryEmbedding**: Reference embeddings for category inference
- **Game/GameQuestion**: Game state and history
- **GameHistory**: User answer history for progress tracking

## 🔄 Data Pipeline

Questions are sourced from J-Archive:

1. **Fetch**: `npm run db:fetch` scrapes recent games
2. **Backfill**: `npm run db:backfill --start-date 2020-01-01 --end-date 2024-01-01`
3. **Embeddings**: Automatically generated via OpenAI's text-embedding-3-small
4. **Category Inference**: pgvector finds nearest knowledge category by cosine similarity

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy!

### Self-Hosted
```bash
npm run build
npm run start
```

Requires:
- PostgreSQL with pgvector
- Node.js 18+
- Reverse proxy (nginx/caddy) for HTTPS

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
