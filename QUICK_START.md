# Markdly Quick Start

## 🚀 5-Minute Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create `.env.local` File

```env
# Database (Vercel Postgres, Neon, or local)
POSTGRES_URL="postgres://user:password@host:5432/database"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"

# GitHub OAuth (https://github.com/settings/developers)
GITHUB_CLIENT_ID="your-github-id"
GITHUB_CLIENT_SECRET="your-github-secret"

# Google OAuth (https://console.cloud.google.com)
GOOGLE_CLIENT_ID="your-google-id"
GOOGLE_CLIENT_SECRET="your-google-secret"

# Cloudinary (https://cloudinary.com/console)
CLOUDINARY_CLOUD_NAME="your-cloud"
CLOUDINARY_API_KEY="your-key"
CLOUDINARY_API_SECRET="your-secret"
```

### 3. Set Up Database

```bash
# Option A: Using Drizzle (Recommended)
npm run db:push

# Option B: Using Raw SQL
npm run db:sql
```

### 4. Start Development

```bash
npm run dev
```

### 5. Open Browser

- **Landing**: http://localhost:3000
- **Sign In**: http://localhost:3000/auth/signin
- **Dashboard**: http://localhost:3000/dashboard

---

## 📋 Database Schema Files

You have **3 options** to create the database:

### Option 1: Drizzle ORM (Recommended)

```bash
npm run db:push
```

- Uses `db/schema.ts`
- Auto-generates migrations
- Best for development

### Option 2: Raw SQL

```bash
npm run db:sql
```

- Uses `db/schema.sql`
- Direct PostgreSQL import
- Best for manual control

### Option 3: Drizzle Studio (GUI)

```bash
npm run db:studio
```

- Browser-based database manager
- Visual schema editing
- Best for beginners

---

## 🔑 Key Files

| File                                    | Purpose                             |
| --------------------------------------- | ----------------------------------- |
| `db/schema.ts`                          | Drizzle ORM schema                  |
| `db/schema.sql`                         | Raw SQL schema                      |
| `db/migrations/0001_initial_schema.sql` | Migration file                      |
| `.env.local`                            | Environment variables (create this) |
| `SETUP.md`                              | Full setup guide                    |

---

## 🎯 What Gets Created

### Tables (9 total)

1. `users` - User accounts
2. `workspaces` - Team workspaces
3. `github_connections` - GitHub OAuth connections
4. `google_connections` - Google OAuth connections
5. `sync_configs` - Sync configurations
6. `sync_history` - Sync operation history
7. `documents` - Tracked Google Docs
8. `api_keys` - API keys (for Phase 4)
9. `audit_logs` - Audit trail

### Indexes (14 total)

- Optimized for common queries
- Foreign key constraints
- Unique constraints

---

## 🔧 Common Commands

```bash
# Development
npm run dev

# Database
npm run db:push      # Push schema
npm run db:generate  # Generate migrations
npm run db:studio    # Open GUI

# Build
npm run build
npm run start

# Lint
npm run lint
```

---

**Ready to build! 🚀**
