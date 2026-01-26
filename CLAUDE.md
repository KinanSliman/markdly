# Markdly - Complete Project Plan

## Executive Summary

**Markdly turns Google Docs into GitHub-ready Markdown — automatically.**

A reliable sync tool for developer relations teams, docs teams, and open-source projects. Unlike basic converters, Markdly focuses on **getting the details right**: images, tables, code blocks, and Git-native workflows.

**Core Value Proposition**: The safest way to get Docs into GitHub.

---

## ✅ What's Already Completed

### 1. **Authentication Setup** ✅
- **GitHub OAuth**: Full integration with `repo` and `user:email` scopes
- **Google OAuth**: Full integration with Drive + Docs API access (`drive.readonly`, `drive.file`)
- **Email/Password Auth**: New! Sign up with email and password
- **Email Verification**: Required for email/password users
- **Session Management**: NextAuth.js with JWT strategy
- **Database**: Drizzle ORM with PostgreSQL
- **Admin Dashboard**: User management and analytics for admin users

### 2. **Dashboard & UI** ✅
- Dashboard with connection status, sync history, tracked documents
- Settings page with connection management
- Protected routes (auth required)
- Toast notifications for feedback
- **Logout functionality** - Sign out button available in user menu (avatar dropdown) on all dashboard and admin pages

### 3. **Database Schema** ✅
**Tables**: users, sessions, accounts, verification_tokens, workspaces, github_connections, google_connections, sync_configs, sync_history, documents, api_keys, audit_logs, **analytics**

**users** table now includes:
- `password_hash`: For email/password authentication
- `signup_source`: 'email', 'github', or 'google'
- `signup_date`: When user created account
- `last_login`: Last login timestamp
- `isAdmin`: Admin flag for admin dashboard access

**analytics** table (new):
- `id`, `userId`, `event`, `metadata`, `createdAt`
- Tracks user events: signup, oauth_connect, sync, sync_success, sync_failed

- **sync_history** now includes:
- `filePath`: Path to the file in GitHub repo (for direct downloads)
- `user_id`: User who performed the sync (for analytics tracking)

### 4. **Core Libraries** ✅
- Google Docs API integration
- GitHub API (Octokit) integration
- Cloudinary integration
- Markdown converter (tables, code blocks, headings, images)
- Front matter template system

### 5. **Sync Engine** ✅
- Complete workflow: Google Doc → Markdown → GitHub PR
- Auto token refresh for expired Google OAuth tokens
- Sync history with delete functionality
- Tracked documents with one-click sync
- **Direct file downloads** from sync history (downloads from GitHub via commit SHA)

### 6. **Critical Bug Fixes** ✅
- OAuth redirect_uri_mismatch → Fixed callback URLs
- OAuthAccountNotLinked → Added test users
- expires_at type mismatch → Changed to `integer` (Unix timestamps)
- Missing workspace auto-creation → Added in auth callback and page fallbacks
- Google Drive folder visibility → Changed to direct document selection
- Expired Google OAuth tokens → Added automatic token refresh and reconnection flow

### 7. **Email/Password Authentication & Admin Dashboard** ✅
- **Email Signup**: Users can sign up with email and password
- **Email Verification**: Required before dashboard access (simulated for demo)
- **Admin Dashboard**:
  - `/admin` - Overview with user stats, sync stats, success rates
  - `/admin/users` - List all users with details (source, verification, sync count)
  - `/admin/analytics` - Event tracking and analytics breakdown
- **Analytics Tracking**: Tracks signup, OAuth connections, sync success/failure
- **Admin Access**: Controlled by `ADMIN_EMAIL` env var or `isAdmin` flag

---

## Competitive Advantage Features

### 1. **Image Handling Done Right** (Primary Differentiator)
- CDN Integration (Cloudinary) with auto-optimization
- Production-ready CDN links (not GitHub-hosted)
- Image extraction and link replacement

### 2. **Google Docs → Markdown Conversion**
- Robust table parsing
- Code block detection and formatting
- Heading hierarchy auto-fix
- Image extraction from inline objects
- Text formatting (bold, italic, underline, links)

### 3. **Git-Native Workflow**
- PR-based review with auto-created feature branches
- Clean commit messages
- Multi-framework support (Next.js, Hugo, Docusaurus, Astro)

### 4. **Reliable Sync Engine**
- Manual sync on-demand
- Automatic token refresh for expired OAuth tokens
- Detailed sync history with delete functionality
- Error handling with retry options
- **Image Handling**: Automatic upload to Cloudinary with CDN URLs

---

## What's Working Now

1. **✅ GitHub OAuth** - Connected and working
2. **✅ Google OAuth** - Connected with automatic token refresh
3. **✅ Email/Password Auth** - Sign up and sign in with email/password
4. **✅ Email Verification** - Required for email/password users
5. **✅ Database** - All 13 tables created with correct types (including analytics), sync_history now tracks user_id
6. **✅ Dashboard** - Connection status, sync history, tracked documents
7. **✅ Sync Execution** - Complete workflow with auto-retry on token expiry
8. **✅ Document Selection** - Direct Google Doc selection (no folder limitation)
9. **✅ Sync History** - Shows doc title, status, commit SHA, file count, timestamp
10. **✅ Delete Functionality** - Sync history entries can be deleted with confirmation
11. **✅ Google Docs → Markdown** - Tables, code blocks, headings, images, formatting
12. **✅ Token Refresh** - Automatic reconnection flow for expired tokens
13. **✅ Direct File Downloads** - Download synced files directly from GitHub in sync history
14. **✅ Document Preview** - Modern modal dialog with syntax-styled preview, copy button, and truncation indicators
15. **✅ Convert-Only Mode** - Convert Google Docs to Markdown without GitHub sync (download directly)
16. **✅ Analytics Tracking** - Track signup, OAuth connections, sync events
17. **✅ Admin Dashboard** - User management and analytics for admin pages
18. **✅ Logout Functionality** - Sign out button in user menu (avatar dropdown) for dashboard and admin pages

---

## Current Status: Phase 1 MVP - Complete

### Test Results

**Converter Test** ✅ PASSED
- Successfully converted real Google Doc with tables, code blocks (7 languages), headings, lists, blockquotes, links, task lists

**Google OAuth Reconnection Flow** ✅ PASSED
- Detects expired tokens → Shows reconnection card → One-click reconnect → Redirects to Google → Returns with new refresh token

**Sync History with Delete** ✅ PASSED
- Displays all sync operations → Delete button with confirmation → Immediate UI update

**Cloudinary Image Handling** ✅ IMPLEMENTED
- Images extracted from Google Docs → Uploaded to Cloudinary → Markdown links updated with CDN URLs
- Preserves Markdown syntax: `![alt](url)` → `![alt](cloudinary-cdn-url)`

---

## Database Schema (Key Tables)

### sync_history
- `id`, `syncConfigId`, `docId`, `docTitle`, `status` (pending/success/failed), `errorMessage`, `filesChanged`, `commitSha`, `filePath`, `startedAt`, `completedAt`
- **`filePath`**: Path to the file in GitHub repo (used for direct downloads)

### documents (tracked)
- `id`, `syncConfigId`, `googleDocId`, `title`, `lastSynced`, `metadata` (commitSha, prUrl, filePath)

### sync_configs
- `id`, `workspaceId`, `githubConnectionId`, `googleConnectionId`, `name`, `mode` (github/convert-only), `framework`, `outputPath`, `frontmatterTemplate`, `imageStrategy`

---

## Sync Flow

```
1. User creates sync config (GitHub repo + Google Doc + framework)
   → Document is tracked in documents table
2. User clicks "Sync" → POST /api/sync
3. Execute sync:
   a. Fetch Google Doc (auto-refresh token if expired)
   b. Convert to Markdown with image processing:
      - Extract images from Google Doc
      - Upload to Cloudinary (if imageStrategy = "cloudinary")
      - Replace URLs with Cloudinary CDN URLs
      - Process tables, code blocks, headings
   c. Generate front matter from template
   d. Create GitHub branch & commit
   e. Create Pull Request
   f. Log to sync_history with docTitle
4. Return PR URL to user
```

## Google OAuth Token Refresh Flow

```
1. Page detects expired token → GoogleReconnectRequiredError
2. Shows "Reconnection Required" card
3. User clicks "Reconnect Google"
4. Disconnects existing account (cleans up sync_history, documents, sync_configs)
5. Redirects to Google OAuth with prompt=consent
6. User authorizes → Gets new refresh token
7. Redirected back → Google Docs listed successfully
```

---

## Files Created/Updated

### Core Sync Logic
- `lib/sync/index.ts` - Sync execution with auto token refresh (supports convert-only mode)
- `app/api/sync/route.ts` - Sync API endpoint (supports convert-only mode)
- `app/api/sync-config/route.ts` - Sync configuration API (supports convert-only mode)
- `app/api/sync-history/[id]/route.ts` - Delete sync history endpoint
- `app/api/download/route.ts` - Download synced files from GitHub
- `app/api/preview/route.ts` - Fetch markdown content for preview (first 2000 chars) with metadata
- `app/api/convert-and-download/route.ts` - Convert Google Doc to Markdown and download directly

### Authentication & Onboarding
- `app/dashboard/page.tsx` - Shows sign-in prompt when not authenticated (removed redirect to /api/auth/signin)
- `components/forms/signin-button.tsx` - Updated default callbackUrl to `/dashboard`

### UI Components
- `components/forms/sync-config-form.tsx` - Create sync configurations (supports GitHub Sync vs Convert Only modes)
- `components/forms/reconnect-google-button.tsx` - One-click Google reconnection
- `components/forms/delete-sync-button.tsx` - Delete sync history with confirmation
- `components/forms/sync-button.tsx` - Sync button that adapts to mode (GitHub Sync vs Convert & Download)
- `components/sync-history-list.tsx` - Client-side sync history list with download & preview buttons (modern modal UI with syntax-styled preview, copy functionality, truncation indicators)
- `components/ui/dialog.tsx` - Radix UI Dialog component
- `components/layout/user-menu.tsx` - User dropdown menu with logout button (Sign out option with LogOut icon)

### Pages
- `app/settings/sync-configs/page.tsx` - Sync config management with reconnection flow, shows Convert Only badge
- `app/dashboard/syncs/page.tsx` - Sync history with delete support and file downloads
- `app/dashboard/documents/page.tsx` - Tracked documents

### Library Updates
- `lib/auth/index.ts` - Added `prompt: "consent"`, `access_type: "offline"`
- `lib/google/index.ts` - Added token refresh functions and `GoogleReconnectRequiredError`
- `lib/cloudinary/index.ts` - Updated `processImagesInMarkdown()` to preserve Markdown syntax
- `lib/markdown/converter.ts` - Added `processGoogleDocImage()` for authenticated image upload
- `lib/sync/index.ts` - Integrated image processing into converter, saves `filePath` to sync_history, supports convert-only mode
- `app/api/auth/disconnect/route.ts` - Added sync cleanup (sync_history → documents → sync_configs)
- `app/api/download/route.ts` - New endpoint for downloading synced files from GitHub
- `app/api/convert-and-download/route.ts` - New endpoint for converting Google Docs to Markdown and downloading directly

---

## Environment Variables

```env
POSTGRES_URL=your_postgres_url
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Admin access (optional - for admin dashboard)
ADMIN_EMAIL=your-email@example.com
```

---

## Next Steps (Phase 2 - Polish & Reliability)

1. **Error Handling & Retries** - Detailed sync logs, retry mechanism
2. **Multi-Framework Support** - Template system for different SSGs
3. **Link Validation** - Check external links before sync
4. **Prettier Integration** - Auto-format with repo's Prettier config
5. **Change Detection** - Show diff of what changed since last sync
6. **Image Handling** - Full Cloudinary integration for CDN URLs

---

## What's NOT in v1 (Cut for MVP)

- ❌ AI-powered metadata generation
- ❌ Bi-directional sync
- ❌ Scheduled/cron sync
- ❌ Analytics dashboards
- ❌ Enterprise SSO
- ❌ API access
- ❌ Team collaboration features
- ❌ Advanced image handling (responsive images, lazy loading)

---

## Email/Password Authentication & Admin Dashboard

### Email/Password Auth Flow
1. **Signup** (`/auth/signup`):
   - User enters name, email, password
   - Password is hashed with bcrypt (12 salt rounds)
   - Account created with `signupSource: "email"`, `emailVerified: null`
   - Analytics event `signup` tracked

2. **Email Verification** (`/auth/verify-email`):
   - Email verification required before dashboard access
   - Verification token stored in `verification_tokens` table
   - Email link: `/api/auth/verify-email?token=<token>`
   - Marks user as verified and updates `emailVerified` timestamp

3. **Signin** (`/auth/signin`):
   - Email/password form validates credentials
   - Updates `lastLogin` timestamp on successful sign-in
   - Redirects to dashboard

### Admin Dashboard
**Access Control**:
- Set `ADMIN_EMAIL` env var for admin access
- Or set `isAdmin: true` in database for specific users

**Pages**:
- `/admin` - Overview with stats (total users, new users, active users, total syncs, success rate)
- `/admin/users` - List all users with details:
  - Name, email, signup source (email/github/google)
  - Email verification status
  - Admin status
  - Sync count
  - Signup date, last login
- `/admin/analytics` - Event tracking breakdown:
  - Event counts by type
  - Recent events with metadata
  - User event breakdown

**Logout**:
- Available on all admin pages via user menu in header
- Click user avatar (top-right) → Select "Sign out" from dropdown
- Redirects to homepage after logout

### Analytics Tracking
**Tracked Events**:
- `signup` - New user signup (with source: email/github/google)
- `oauth_connect` - OAuth account connection
- `sync_success` - Successful sync operation
- `sync_failed` - Failed sync operation

**Database**: `analytics` table with `userId`, `event`, `metadata`, `createdAt`

### Files Created
- `types/next-auth.d.ts` - Extended NextAuth types for custom session fields
- `lib/auth/credentials.ts` - Credentials provider and password hashing
- `lib/auth/admin.ts` - Admin access control functions
- `lib/analytics/index.ts` - Analytics tracking functions
- `components/forms/email-signup-form.tsx` - Email signup form
- `components/forms/email-signin-form.tsx` - Email signin form
- `app/api/auth/signup/route.ts` - Signup API endpoint
- `app/api/auth/verify-email/route.ts` - Email verification API
- `app/auth/signup/page.tsx` - Signup page
- `app/auth/verify-email/page.tsx` - Verify email page
- `app/admin/page.tsx` - Admin overview
- `app/admin/users/page.tsx` - Admin users management
- `app/admin/analytics/page.tsx` - Admin analytics
- `app/api/admin/stats/route.ts` - Admin stats API
- `app/api/admin/users/route.ts` - Admin users API
- `db/migrations/0002_email_auth_analytics.sql` - SQL migration for email auth and analytics schema changes

### Files Modified
- `db/schema.ts` - Added password_hash, signup_source, signup_date, last_login, is_admin to users; added user_id to sync_history; created analytics table
- `lib/auth/index.ts` - Added CredentialsProvider, updated callbacks for email auth and analytics
- `lib/sync/index.ts` - Added analytics tracking for sync operations, added userId to sync_history
- `app/auth/signin/page.tsx` - Added email/password form
- `app/dashboard/page.tsx` - Added email verification warning, updated sign-in prompt
- `components/layout/dashboard-nav.tsx` - Added admin link (conditional)
- `components/layout/dashboard-shell.tsx` - Made async for admin check
- `components/layout/user-menu.tsx` - Added logout button with Sign out option (LogOut icon, redirects to homepage)
- `package.json` - Added bcryptjs and @types/bcryptjs dependencies

### Database Migration
```sql
-- Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_date TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add user_id to sync_history for analytics tracking
ALTER TABLE sync_history ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_user_id ON analytics(user_id);
CREATE INDEX idx_analytics_event ON analytics(event);
CREATE INDEX idx_analytics_created_at ON analytics(created_at);
CREATE INDEX idx_sync_history_user_id ON sync_history(user_id);
```

---

## Direct File Download Feature

### How It Works
1. **Database**: Added `filePath` column to `sync_history` table
2. **Sync Execution**: When a sync succeeds, the file path is saved to `sync_history`
3. **API Endpoint**: `/api/download?syncId=<id>` fetches file content from GitHub using commit SHA and file path
4. **UI**: Download button appears on each successful sync entry in the Sync History page

### Files Modified
- `db/schema.ts` - Added `filePath` to sync_history table
- `db/migrations/0001_initial_schema.sql` - Added `file_path TEXT` column
- `lib/sync/index.ts` - Saves `filePath` when updating sync history
- `app/api/download/route.ts` - New endpoint for downloading files from GitHub
- `app/dashboard/syncs/page.tsx` - Fetches file path from documents table for backward compatibility
- `components/sync-history-list.tsx` - Added download button with loading state

### Database Migration (Manual)
```sql
ALTER TABLE sync_history ADD COLUMN IF NOT EXISTS file_path TEXT;
```

---

## Technical Architecture

### Backend
- **Framework**: Next.js 15 (App Router) with Turbopack
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: NextAuth.js with GitHub + Google
- **File Storage**: Cloudinary (images)

### Frontend
- **Framework**: Next.js 15
- **UI Library**: shadcn/ui + Tailwind CSS

---

## User Flow

### New User Onboarding (Email/Password)
1. User lands on homepage (`/`)
2. Clicks "Start Syncing Free" or "Get Started" → redirects to `/dashboard`
3. Dashboard shows sign-in prompt with email/password option
4. User clicks "Sign up" → `/auth/signup`
5. User enters name, email, password → Account created
6. User redirected to `/auth/verify-email` (email verification required)
7. User verifies email (simulated for demo)
8. User signs in with email/password → Redirected to `/dashboard`
9. **Workspace is automatically created** in the JWT callback
10. Dashboard shows onboarding banner with connection buttons
11. User connects GitHub and Google accounts
12. User creates sync configuration in Settings → Sync Configurations
13. User syncs documents

### New User Onboarding (OAuth)
1. User lands on homepage (`/`)
2. Clicks "Start Syncing Free" or "Get Started" → redirects to `/dashboard`
3. Dashboard shows sign-in prompt (GitHub or Google)
4. After signing in, user is redirected back to `/dashboard`
5. **Workspace is automatically created** in the JWT callback
6. Dashboard shows onboarding banner with connection buttons
7. User connects GitHub and Google accounts
8. User creates sync configuration in Settings → Sync Configurations
9. User syncs documents

### Returning User
1. User visits `/dashboard` directly
2. If not authenticated: shown sign-in prompt
3. If authenticated: sees dashboard with connection status, sync history, etc.

### Admin User
1. Admin user signs in (email/password or OAuth)
2. Admin sees "Admin" link in sidebar navigation
3. Admin can access `/admin` dashboard
4. View user stats, sync stats, success rates
5. Manage users in `/admin/users`
6. View analytics in `/admin/analytics`
7. **Logout**: Click user avatar in top-right → Select "Sign out" from dropdown menu

## Testing the Sync Flow

1. Connect GitHub account (Dashboard → "Connect GitHub" or Settings → GitHub Connection)
2. Connect Google account (Dashboard → "Connect Google" or Settings → Google Connection)
3. Go to Settings → Sync Configurations
4. Create a new sync configuration:
   - Enter configuration name
   - Select GitHub repo
   - Select Google Drive document
   - Choose framework (Next.js, Hugo, etc.)
   - Set output path (e.g., `content/posts/`)
   - Use default front matter template
   - Select Cloudinary as image strategy
5. Document appears in "Tracked Documents"
6. Click "Sync" button
7. Check PR on GitHub and sync history on dashboard

---

## Known Issues & Fixes

1. **OAuth redirect_uri_mismatch** → Fixed by adding correct callback URLs
2. **OAuthAccountNotLinked** → Fixed by adding test users
3. **expires_at type error** → Changed to `integer` (Unix timestamps)
4. **Expired Google OAuth tokens** → Added automatic token refresh flow
5. **Database clearing** → Sign out and sign back in to create new user

## Authentication Flow Changes

### Previous Flow
1. Homepage → "Start Syncing Free" → `/api/auth/signin` (sign-in page)
2. Sign in with provider → Redirected to `/settings`
3. User connects accounts from Settings page
4. Workspace created during auth callback

### New Flow
1. Homepage → "Start Syncing Free" → `/dashboard`
2. **Dashboard shows sign-in prompt** if not authenticated
3. Sign in with GitHub or Google → Redirected back to `/dashboard`
4. **Workspace is automatically created** in JWT callback (unchanged)
5. Dashboard shows onboarding banner with connection buttons
6. User connects accounts directly from dashboard

### Key Changes
- **`app/dashboard/page.tsx`**: No longer redirects to sign-in page. Instead, shows a sign-in prompt UI when not authenticated
- **`components/forms/signin-button.tsx`**: Default `callbackUrl` changed from `/settings` to `/dashboard`
- **Workspace creation**: Still handled in `lib/auth/index.ts` JWT callback - works seamlessly with new flow

---

## Success Criteria

**10 paying customers in 3 months** = validation

---

## Remember

**Your main enemy is scope, not competition.**

Build the ruthlessly cut MVP first. Validate. Then expand.
