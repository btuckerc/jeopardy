# Jeopardy Game

A TypeScript-based Jeopardy game with two play modes: Classic Game and Practice Mode. Built with modern web technologies for an engaging trivia experience.

## Features

- **Classic Game Mode**: Emulate a real Jeopardy game experience
- **Practice Mode**: Freely explore categories and questions at your own pace
- **User Authentication**: Secure login and user progress tracking
- **Statistics**: Track your performance and improvement over time
- **Modern UI**: Built with Tailwind CSS for a responsive and clean interface

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL with Prisma ORM
- **State Management**: React Query
- **Deployment**: Vercel (recommended)

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Supabase account for auth

## Getting Started

1. Clone the repository:

```bash
git clone [your-repo-url]
cd jeopardy
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
Create a `.env` file with the following:
```
DATABASE_URL="your-postgresql-url"
DIRECT_URL="your-direct-postgresql-url"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

4. Initialize the database:

```bash
# Generate Prisma client and push schema changes
npx prisma generate && npx prisma db push

# Deploy migrations
npx prisma migrate deploy

# Load initial data (optional)
npx ts-node src/scripts/fetch-jeopardy-data.ts 50
npx ts-node src/scripts/init-db.ts
```

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start playing!

## Database Management

The following npm scripts are available for database management:

```bash
# Generate Prisma client and apply migrations
npm run db:update

# Complete database setup (generate, migrate, and seed)
npm run db:setup

# Reset database (caution: this will delete all data)
npm run db:reset

# Generate Prisma client only
npm run db:generate

# Run migrations only
npm run db:migrate

# Push schema changes (development only)
npm run db:push

# Seed the database with initial data
npm run db:seed

# Fetch new questions (specify count as argument)
npm run db:fetch -- 50
```

For development, you can use `db:push` for quick schema iterations. For production deployments, always use `db:update` to ensure proper migration management.

## Development

```bash
# Start development server
npm run dev

# Type checking
npm run typecheck

# Lint and type check
npm run validate
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Your chosen license]
