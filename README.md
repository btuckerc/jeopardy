# trivrdy - Study Jeopardy Online

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-green)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)](https://www.prisma.io/)

trivrdy is a modern, interactive Jeopardy study platform that helps you improve your trivia knowledge through authentic Jeopardy questions. Practice at your own pace or challenge yourself with full game simulations.

## 🎮 Game Modes

### Classic Game Mode
- Complete Jeopardy board simulation
- Six categories with five questions each
- Authentic scoring system
- Real questions from past Jeopardy episodes
- Multiplayer support coming soon!

### Practice Mode
- Focus on specific knowledge categories
- Track your progress and statistics
- Personalized question recommendations
- Spaced repetition learning
- Custom difficulty settings

## 📊 Features

- **Smart Answer Validation**: Intelligent answer checking that understands variations and common alternatives
- **Knowledge Categories**: Questions organized by subject area (History, Science, Arts, etc.)
- **Progress Tracking**: Detailed statistics and performance analytics
- **Spoiler Protection**: Built-in system to avoid questions from recent episodes
- **Responsive Design**: Optimized for both desktop and mobile play
- **User Profiles**: Customizable avatars and display names
- **Leaderboards**: Compete with other players globally
- **Dark Mode**: Eye-friendly dark theme support

## 🛠 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS with custom theming
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL with Prisma ORM
- **State Management**: React Query
- **Hosting**: Vercel
- **Analytics**: Vercel Analytics

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Supabase account
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

3. Set up environment variables:
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

4. Initialize the database:
```bash
npm run db:setup
```

5. Start development server:
```bash
npm run dev
```

## 📦 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm run validate     # Run all checks

# Database
npm run db:setup     # Complete database setup
npm run db:reset     # Reset database (caution!)
npm run db:migrate   # Run migrations
npm run db:generate  # Generate Prisma client
npm run db:seed      # Seed initial data
npm run db:fetch     # Fetch new questions
```

## 🔄 Update Cycle

- Questions are regularly updated from recent Jeopardy episodes
- Database migrations are automatically applied during deployment
- Regular security updates and dependency maintenance

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

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
