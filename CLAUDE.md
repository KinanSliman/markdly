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
- **Session Management**: NextAuth.js with JWT strategy
- **Database**: Drizzle ORM with PostgreSQL

### 2. **Dashboard & UI** ✅
- Dashboard with connection status, sync history, tracked documents
- Settings page with connection management
- Protected routes (auth required)
- Toast notifications for feedback

### 3. **Database Schema** ✅
**Tables**: users, sessions, accounts, verification_tokens, workspaces, github_connections, google_connections, sync_configs, sync_history, documents, api_keys, audit_logs

- **sync_history** now includes `filePath` column for direct file downloads

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
3. **✅ Database** - All 12 tables created with correct types
4. **✅ Dashboard** - Connection status, sync history, tracked documents
5. **✅ Sync Execution** - Complete workflow with auto-retry on token expiry
6. **✅ Document Selection** - Direct Google Doc selection (no folder limitation)
7. **✅ Sync History** - Shows doc title, status, commit SHA, file count, timestamp
8. **✅ Delete Functionality** - Sync history entries can be deleted with confirmation
9. **✅ Google Docs → Markdown** - Tables, code blocks, headings, images, formatting
10. **✅ Token Refresh** - Automatic reconnection flow for expired tokens
11. **✅ Direct File Downloads** - Download synced files directly from GitHub in sync history

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
- `id`, `workspaceId`, `githubConnectionId`, `googleConnectionId`, `name`, `framework`, `outputPath`, `frontmatterTemplate`, `imageStrategy`

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
- `lib/sync/index.ts` - Sync execution with auto token refresh
- `app/api/sync/route.ts` - Sync API endpoint
- `app/api/sync-config/route.ts` - Sync configuration API
- `app/api/sync-history/[id]/route.ts` - Delete sync history endpoint
- `app/api/download/route.ts` - Download synced files from GitHub

### UI Components
- `components/forms/sync-config-form.tsx` - Create sync configurations
- `components/forms/reconnect-google-button.tsx` - One-click Google reconnection
- `components/forms/delete-sync-button.tsx` - Delete sync history with confirmation
- `components/sync-history-list.tsx` - Client-side sync history list with download button
- `components/ui/dialog.tsx` - Radix UI Dialog component

### Pages
- `app/settings/sync-configs/page.tsx` - Sync config management with reconnection flow
- `app/dashboard/syncs/page.tsx` - Sync history with delete support and file downloads
- `app/dashboard/documents/page.tsx` - Tracked documents

### Library Updates
- `lib/auth/index.ts` - Added `prompt: "consent"`, `access_type: "offline"`
- `lib/google/index.ts` - Added token refresh functions and `GoogleReconnectRequiredError`
- `lib/cloudinary/index.ts` - Updated `processImagesInMarkdown()` to preserve Markdown syntax
- `lib/markdown/converter.ts` - Added `processGoogleDocImage()` for authenticated image upload
- `lib/sync/index.ts` - Integrated image processing into converter, saves `filePath` to sync_history
- `app/api/auth/disconnect/route.ts` - Added sync cleanup (sync_history → documents → sync_configs)
- `app/api/download/route.ts` - New endpoint for downloading synced files from GitHub

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

## Testing the Sync Flow

1. Connect GitHub account (Settings → GitHub Connection)
2. Connect Google account (Settings → Google Connection)
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

---

## Success Criteria

**10 paying customers in 3 months** = validation

---

## Remember

**Your main enemy is scope, not competition.**

Build the ruthlessly cut MVP first. Validate. Then expand.
