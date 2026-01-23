# Markdly

**Turn Google Docs into GitHub-ready Markdown — automatically.**

A reliable sync tool for developer relations teams, docs teams, and open-source projects.

## Features

- ✅ **Image Handling Done Right** - Upload to Cloudinary with auto-optimization and CDN URLs
- ✅ **Robust Conversion** - Google Docs tables, code blocks, headings converted accurately
- ✅ **Git-Native Workflow** - Auto-create feature branches and pull requests
- ✅ **Front Matter Templates** - Custom YAML templates with variable support

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Vercel Postgres)
- **ORM**: Drizzle ORM
- **Auth**: NextAuth.js (GitHub + Google)
- **UI**: shadcn/ui + Tailwind CSS
- **Image Storage**: Cloudinary
- **State Management**: Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Vercel Postgres recommended)
- GitHub OAuth App
- Google OAuth App
- Cloudinary account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
4. Configure your OAuth apps and add credentials to `.env.local`

### Development

```bash
npm run dev
```

### Database Setup

```bash
# Generate migrations
npm run db:generate

# Push schema to database
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

## Project Structure

```
/app                    # Next.js App Router routes
/components             # React components
  /ui                   # shadcn/ui components
  /layout               # Layout components
  /forms                # Form components
/lib                    # Utility libraries
  /markdown             # Markdown conversion
  /github               # GitHub integration
  /google               # Google integration
  /cloudinary           # Image handling
/db                     # Database schema
```

## Phase 1 MVP Features

1. **Auth Setup** - GitHub + Google OAuth
2. **Google Docs → Markdown** - Robust conversion with tables, code blocks, images
3. **GitHub Integration** - Create files, commits, and PRs
4. **Image Handling** - Cloudinary upload and optimization
5. **Basic Dashboard** - Connect accounts and trigger syncs
6. **Front Matter Templates** - YAML templates with variables

## Environment Variables

See `.env.example` for required environment variables.

## License

MIT
