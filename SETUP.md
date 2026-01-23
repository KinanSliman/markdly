# Markdly Setup Guide

## Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL database (Vercel Postgres, Neon, or local PostgreSQL)
- GitHub OAuth App
- Google OAuth App
- Cloudinary account

---

## 1. Install Dependencies

### Via PowerShell (Windows/WSL):
```powershell
cd C:\Users\Kin\Desktop\markdly
npm install
```

### Via Bash (Linux/Mac):
```bash
cd ~/Desktop/markdly
npm install
```

---

## 2. Set Up PostgreSQL Database

### Option A: Vercel Postgres (Recommended for Production)
1. Go to [vercel.com/postgres](https://vercel.com/postgres)
2. Create a new Postgres database
3. Copy the connection string (starts with `postgres://`)

### Option B: Neon (Free PostgreSQL)
1. Go to [neon.tech](https://neon.tech)
2. Create a free account and project
3. Copy the connection string

### Option C: Local PostgreSQL
1. Install PostgreSQL on your system
2. Create a database:
   ```sql
   CREATE DATABASE markdly;
   ```
3. Connection string: `postgresql://username:password@localhost:5432/markdly`

---

## 3. Create Environment Variables

Create a file named `.env.local` in the project root:

```env
# Database (Vercel Postgres example)
POSTGRES_URL="postgres://user:password@host:5432/database"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32

example:
PS C:\Windows\system32>   [System.Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Minimum 0 -Maximum 256) }))
DY7EB7l2w3IZpOGCZYFwk2at6BcAoGXRXY+JJH5a7uU=
PS C:\Windows\system32>

# GitHub OAuth
# Create at: https://github.com/settings/developers
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Google OAuth
# Create at: https://console.cloud.google.com
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Cloudinary
# Get from: https://cloudinary.com/console
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### Generate NextAuth Secret:
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).Guid))
```

---

## 4. Configure OAuth Apps

### GitHub OAuth App
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Markdly (or your choice)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy **Client ID** and **Client Secret**

### Google OAuth Client
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen (external or internal)
6. Add authorized redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
7. Copy **Client ID** and **Client Secret**

---

## 5. Configure Cloudinary
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard
3. Copy:
   - **Cloud name**
   - **API Key**
   - **API Secret**

---

## 6. Set Up Database Schema

### Option A: Using Drizzle ORM (Recommended)
```bash
# Push schema to database
npm run db:push

# Or generate migration files
npm run db:generate
```

### Option B: Using Raw SQL
1. Open your PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Run the SQL from `db/schema.sql`
4. Or run via command line:
   ```bash
   psql "$POSTGRES_URL" -f db/schema.sql
   ```

### Option C: Using Drizzle Studio (GUI)
```bash
# Open Drizzle Studio
npm run db:studio
```
This opens a browser-based GUI to manage your database.

---

## 7. Run Development Server

```bash
npm run dev
```

The app will be available at:
- **Local**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **Sign In**: http://localhost:3000/auth/signin

---

## 8. Test the Application

1. Open http://localhost:3000
2. Click "Get Started" or "Sign In"
3. Sign in with GitHub or Google
4. You should be redirected to the dashboard
5. Try the "Sync Document" button (will show a demo toast)

---

## 9. Database Management Commands

### View Database in Browser
```bash
npm run db:studio
```

### Generate Migrations
```bash
npm run db:generate
```

### Push Schema to Database
```bash
npm run db:push
```

### Check Database Status
```bash
# Connect via psql
psql "$POSTGRES_URL"
```

---

## 10. Troubleshooting

### Database Connection Issues
- Verify your `POSTGRES_URL` is correct
- Ensure your database allows connections from your IP
- Check if the database exists

### OAuth Issues
- Verify callback URLs match exactly (including http/https)
- Ensure Client ID and Secret are correct
- Check that scopes are properly configured

### Port Already in Use
```bash
# Kill process on port 3000
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Windows PowerShell
Get-Process -Name node | Where-Object { $_.Id -eq (Get-NetTCPConnection -LocalPort 3000).OwningProcess } | Stop-Process
```

---

## 11. Environment-Specific Setup

### Development
- Use `http://localhost:3000` for `NEXTAUTH_URL`
- Use development OAuth credentials

### Production
- Update `NEXTAUTH_URL` to your production domain
- Use production OAuth credentials
- Set up proper HTTPS
- Consider using Vercel for easy deployment

---

## 12. Next Steps

Once the basic setup is complete:

1. **Connect GitHub**: Go to Settings → Connect GitHub
2. **Connect Google**: Go to Settings → Connect Google
3. **Create Sync Config**: Configure output path and front matter template
4. **Sync a Document**: Trigger your first sync
5. **Check GitHub**: Verify PR was created with correct content

---

## 13. Project Structure Reference

```
markdly/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Protected dashboard routes
│   ├── settings/          # Settings page
│   ├── auth/              # Authentication pages
│   └── api/auth/          # NextAuth API routes
├── components/             # React components
│   ├── layout/            # Layout components
│   ├── forms/             # Form components
│   └── ui/                # shadcn/ui components
├── lib/                    # Core libraries
│   ├── auth/              # Authentication config
│   ├── github/            # GitHub integration
│   ├── google/            # Google integration
│   ├── markdown/          # Markdown conversion
│   ├── cloudinary/        # Image handling
│   └── database/          # Database connection
├── db/                     # Database schema
│   ├── schema.ts          # Drizzle ORM schema
│   ├── schema.sql         # Raw SQL schema
│   └── migrations/        # Migration files
└── .env.local             # Environment variables (create this)
```

---

## 14. Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio GUI
```

---

## 15. Security Notes

- **Never commit `.env.local`** - it's in `.gitignore`
- **Rotate secrets** if they're ever exposed
- **Use strong passwords** for database and services
- **Enable 2FA** on GitHub, Google, and Cloudinary accounts
- **Use HTTPS** in production (Vercel handles this automatically)

---

## 16. Getting Help

- **Documentation**: See `README.md` and `IMPLEMENTATION_SUMMARY.md`
- **Issues**: Check GitHub issues or create a new one
- **Discussions**: Join the community discussions

---

## 17. Production Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Vercel:
Add these in Vercel dashboard → Settings → Environment Variables:
- `POSTGRES_URL`
- `NEXTAUTH_URL` (your production domain)
- `NEXTAUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

---

**Happy syncing! 🚀**
