# Markdly - Complete Project Plan

## Executive Summary

**Markdly turns Google Docs into GitHub-ready Markdown — automatically.**

A reliable sync tool for developer relations teams, docs teams, and open-source projects. Unlike basic converters, Markdly focuses on **getting the details right**: images, tables, code blocks, and Git-native workflows.

**Core Value Proposition**: The safest way to get Docs into GitHub.

## ✅ What's Already Completed

### 1. **Authentication Setup** ✅
- **GitHub OAuth**: Full integration with `repo` and `user:email` scopes
- **Google OAuth**: Full integration with Drive + Docs API access
- **Session Management**: NextAuth.js with JWT strategy
- **Database**: Drizzle ORM with PostgreSQL

**Files**:
- `lib/auth/index.ts` - NextAuth configuration
- `app/api/auth/[...nextauth]/route.ts` - API route
- `components/layout/auth-provider.tsx` - Client-side provider
- `app/auth/signin/page.tsx` - Sign-in page
- `components/forms/signin-button.tsx` - OAuth sign-in button

**Database Tables**:
- `users` - User profiles
- `sessions` - Active sessions
- `accounts` - OAuth account links (fixed: `expires_at` uses `integer` type)
- `verification_tokens` - Email verification

### 2. **Dashboard & UI** ✅
- **Dashboard Shell**: Consistent layout with sidebar navigation
- **Settings Page**: Connection management (GitHub + Google)
- **User Menu**: Avatar dropdown with sign-out
- **Toast Notifications**: In-app feedback
- **Protected Routes**: Auth-required pages

**Files**:
- `app/dashboard/page.tsx` - Main dashboard with connection status
- `app/dashboard/syncs/page.tsx` - Sync history
- `app/dashboard/documents/page.tsx` - Document list
- `app/dashboard/analytics/page.tsx` - Analytics
- `app/settings/page.tsx` - Settings with connection buttons
- `components/layout/dashboard-shell.tsx` - Layout
- `components/layout/dashboard-nav.tsx` - Navigation
- `components/layout/user-menu.tsx` - User dropdown
- `components/forms/sync-button.tsx` - Sync trigger
- `components/ui/` - shadcn/ui components

### 3. **Database Schema** ✅
**Complete schema following the plan**:
- Users, Workspaces, GitHub Connections, Google Connections
- Sync Configurations, Sync History, Documents
- API Keys, Audit Logs

**Files**:
- `db/schema.ts` - Drizzle ORM schema (with `integer` type for `expires_at`)
- `lib/database/index.ts` - Database connection
- `drizzle.config.ts` - Drizzle configuration

**Tables in Database**:
```
✓ users
✓ sessions
✓ accounts (expires_at: integer, not timestamp)
✓ verification_tokens
✓ workspaces
✓ github_connections
✓ google_connections
✓ sync_configs
✓ sync_history
✓ documents
✓ api_keys
✓ audit_logs
```

### 4. **Core Libraries Ready** ✅
- **Google Docs API**: Integration ready in `lib/google/index.ts`
- **GitHub API (Octokit)**: Integration ready in `lib/github/index.ts`
- **Cloudinary**: Integration ready in `lib/cloudinary/index.ts`
- **Markdown Processing**: Converter ready in `lib/markdown/converter.ts`
- **Front Matter**: Template system ready in `lib/markdown/frontmatter.ts`

### 5. **Connection Status UI** ✅
- Dashboard shows real-time connection status (green checkmark / red X)
- "Connect Google" button appears when Google isn't linked
- Settings page has buttons for both GitHub and Google connections
- **Disconnect buttons** - Added to Settings page for both GitHub and Google
  - Shows "✓ Connected" with "Disconnect" button when connected
  - Confirmation dialog before disconnecting
  - Deletes OAuth account and provider-specific connections

### 6. **Critical Bug Fixes** ✅
- **OAuth redirect_uri_mismatch**: Fixed by adding correct callback URLs to Google Cloud Console
- **OAuthAccountNotLinked**: Fixed by adding test users in Google OAuth consent screen
- **expires_at type mismatch**: Changed from `timestamp()` to `integer()` in schema (NextAuth stores Unix timestamps)
- **Missing workspace auto-creation**: Added workspace creation in auth callback and page fallbacks
- **Google Drive folder visibility**: Changed flow from folder selection to direct document selection to show all accessible files
- **Expired Google OAuth tokens**: Added automatic token refresh and reconnection flow with `GoogleReconnectRequiredError`

## Competitive Advantage Features

### 1. **Image Handling Done Right** (Primary Differentiator)
- **CDN Integration**: Upload to Cloudinary/R2/S3 with auto-optimization
- **Image CDN URLs**: Generate production-ready CDN links (not GitHub-hosted)
- **Responsive Images**: Auto-generate srcset for different screen sizes
- **Lazy Loading**: Auto-add loading="lazy" to images
- **Image Compression**: Lossless compression before upload
- **No Broken Links**: Extract, upload, and update all image references automatically

### 2. **Google Docs → Markdown Conversion (The Hard Part)**
- **Robust Table Parsing**: Convert Google Docs tables to proper Markdown tables
- **Code Block Detection**: Auto-detect and format code snippets
- **Heading Hierarchy**: Auto-fix heading levels (H1-H6)
- **Image Extraction**: Handle inline images, drawings, and embedded media
- **Comment Handling**: Preserve or strip comments as configured

### 3. **Git-Native Workflow**
- **PR-Based Review**: Auto-create feature branches and pull requests for review
- **Commit Strategy**: Clean commit messages with proper attribution
- **Multi-Framework Support**: Next.js, Astro, Docusaurus, Hugo, Nuxt, SvelteKit
- **Custom Front Matter**: User-defined YAML templates with variable support

### 4. **Reliable Sync Engine**
- **Manual Sync**: Trigger syncs on-demand (v1 priority)
- **Error Handling**: Clear error messages with retry options
- **Sync History**: Detailed logs of all sync operations
- **Change Detection**: Show what changed since last sync

### 5. **Developer Experience**
- **Prettier Integration**: Auto-format with Prettier config from repo
- **Link Validation**: Check all external links before sync
- **Configurable Output**: Define output paths and file naming

### What's NOT in v1 (Cut for MVP)
- ❌ AI-powered metadata generation
- ❌ Bi-directional sync
- ❌ Incremental section updates
- ❌ Scheduled/cron sync
- ❌ Analytics dashboards
- ❌ Enterprise SSO
- ❌ API access
- ❌ Migration tools
- ❌ Team collaboration features
- ❌ Content quality scoring
- ❌ Advanced image handling (responsive images, CDN upload, lazy loading)
- ❌ Prettier integration
- ❌ Link validation
- ❌ Change detection (diff display)

## Technical Architecture

### Backend Stack
- **Framework**: Next.js 15 (App Router) - Using Turbopack
- **Database**: PostgreSQL (local: `markedly` on localhost:5432)
- **ORM**: Drizzle ORM (better performance than Prisma)
- **Auth**: NextAuth.js with GitHub + Google
- **Queue System**: Upstash Redis + BullMQ for background jobs (ready, not implemented)
- **File Storage**: Cloudinary (images)
- **Payments**: Stripe with webhook handling (ready, not implemented)
- **Email**: Resend for transactional emails (ready, not implemented)
- **Monitoring**: Sentry + Vercel Analytics (ready, not implemented)

### Frontend Stack
- **Framework**: Next.js 15
- **UI Library**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand (ready, not implemented)
- **Forms**: React Hook Form + Zod validation (ready, not implemented)

### Infrastructure
- **Hosting**: Vercel (Pro tier for production)
- **CDN**: Vercel Edge Network + Cloudinary CDN
- **Domain**: markdly.com (or similar)
- **SSL**: Auto-provisioned via Vercel

### Critical Technical Challenge
**Google Docs → Markdown conversion is the hardest technical problem here.**

Tables, comments, images, code blocks, headings — this is where products die.

**Invest disproportionate effort here. It's your moat.**

## Feature Implementation Priority

### Phase 1: True MVP (Week 1-2) - Core Workflow Only
**Goal**: Prove one complete workflow: Google Doc → Clean Markdown → GitHub PR → Images hosted correctly

1. **Auth Setup** ✅ **COMPLETE**
   - GitHub OAuth (repo write access)
   - Google OAuth (Drive + Docs API)
   - Session management
   - Database schema with Drizzle ORM

2. **Google Docs → Markdown** ✅ **COMPLETE** (3 days) - **The Hard Part**
   - Fetch doc content via Google Docs API v1
   - Robust conversion (tables, code blocks, headings, lists)
   - Text formatting (bold, italic, underline, links)
   - Image extraction from inline objects
   - Post-processing (code detection, heading fix, whitespace cleanup, validation)
   - **Tested with real Google Doc** - Successfully converted complex document

3. **GitHub Integration** (2 days)
   - Create/update files in repo
   - Commit with proper message format
   - Create PR for review

4. **Image Handling** (2 days) - **Primary Differentiator**
   - Cloudinary integration (choose ONE strategy)
   - Image upload and optimization
   - Update Markdown links to CDN URLs

5. **Basic Dashboard** ✅ **COMPLETE**
   - Connect accounts UI
   - Manual sync trigger
   - Sync status and history

6. **Document Selection** ✅ **COMPLETE**
   - List all accessible Google Docs (not just folder contents)
   - Direct document selection during sync config creation
   - Tracked documents with one-click sync

7. **Front Matter Templates** (1 day)
   - YAML template editor
   - Variable support ({{title}}, {{date}}, etc.)

**Total MVP Time**: ~11 days (2 weeks)

### Phase 2: Polish & Reliability (Week 3-4)
1. **Error Handling & Retries** (2 days)
   - Detailed sync logs
   - Retry mechanism for transient errors
   - User notifications (in-app)

2. **Multi-Framework Support** (2 days)
   - Template system for different SSGs
   - Configurable output paths

3. **Link Validation** (1 day)
   - Check external links before sync
   - Report broken links

4. **Prettier Integration** (1 day)
   - Auto-format with repo's Prettier config

5. **Change Detection** (1 day)
   - Show diff of what changed since last sync

### Phase 3: Scale & Monetization (Week 5-6)
1. **Billing & Pricing** (2 days)
   - Stripe integration
   - Free tier (5 syncs/month)
   - Pro tier ($19/mo - unlimited syncs)

2. **Sync History Dashboard** (2 days)
   - Detailed logs with filtering
   - Success/failure rates

3. **Email Notifications** (1 day)
   - Daily digest of sync failures
   - Success notifications

4. **Onboarding Flow** (1 day)
   - First-time user experience
   - Quick start guide

### Phase 4: Advanced Features (Month 2+)
**Only build these after validating with paying customers**

1. **Scheduled Sync** (1 week)
   - Cron-based automation
   - Webhook listener for Google Drive

2. **Team Features** (1 week)
   - Multi-user support
   - Role management (Admin, Editor, Viewer)

3. **API Access** (1 week)
   - REST API endpoints
   - API key management

4. **Content Intelligence** (2 weeks)
   - AI-powered metadata generation
   - Content quality scoring
   - SEO insights

5. **Migration Tools** (1 week)
   - Bulk import from GitHub
   - Legacy doc migration

## ✅ Current Status: Phase 1 MVP - Complete with Token Refresh & Delete Functionality

### What's Working Now
1. **✅ GitHub OAuth** - Connected and working
2. **✅ Google OAuth** - Connected and working (with `drive.file` scope for better file access)
3. **✅ Database Schema** - All tables created with correct types
4. **✅ Dashboard UI** - Shows connection status and sync history
5. **✅ Settings Page** - Connection buttons for both providers
6. **✅ Protected Routes** - Auth required for dashboard/settings
7. **✅ Core Libraries** - Google Docs, GitHub, Cloudinary, Markdown converter, Front matter
8. **✅ Sync Execution Logic** - Complete workflow implementation
9. **✅ Sync API Endpoint** - POST /api/sync for triggering syncs (with config auto-detection)
10. **✅ Sync Config Form** - UI for creating sync configurations with document selection
11. **✅ Document Selection** - Direct Google Doc selection (no folder limitation)
12. **✅ Sync History Display** - Shows recent sync operations with delete button
13. **✅ Tracked Documents** - Shows synced documents with metadata and one-click sync
14. **✅ TypeScript Issues Fixed** - All type errors resolved with proper typing
15. **✅ Google Docs → Markdown Converter** - Robust conversion with tables, code blocks, headings, images
16. **✅ Document Discovery** - Lists all accessible Google Docs (including shared files)
17. **✅ Google OAuth Token Refresh** - Automatic token refresh and reconnection flow for expired tokens
18. **✅ Sync History Delete** - Delete button with confirmation dialog for each sync entry
19. **✅ Sync History Display** - Shows doc title, status, commit SHA, file count, timestamp

### Google Docs → Markdown Converter Features (NEW)
**The hardest part of the MVP is now complete!**

| Feature | Status | Description |
|---------|--------|-------------|
| **Doc Fetching** | ✅ Complete | Uses Google Docs API v1 with OAuth2Client |
| **Text Formatting** | ✅ Complete | Bold, italic, underline, strikethrough, links |
| **Headings (H1-H6)** | ✅ Complete | Parses Google Docs heading styles, auto-fixes hierarchy |
| **Lists** | ✅ Complete | Bullet lists, numbered lists, nested lists with indentation |
| **Tables** | ✅ Complete | Converts Google Docs tables to Markdown tables |
| **Code Blocks** | ✅ Complete | Detects code patterns and wraps in ``` fences |
| **Inline Images** | ✅ Complete | Extracts images from inline objects, converts to Markdown |
| **Whitespace Cleanup** | ✅ Complete | Removes excessive newlines and trailing spaces |
| **Markdown Validation** | ✅ Complete | Checks for unclosed code blocks, brackets, formatting |
| **Post-Processing** | ✅ Complete | Code block detection, heading hierarchy fix, list normalization |

**Tested with real Google Doc** ✅ - Successfully converted test document with:
- Multiple heading levels
- Text formatting (bold, italic, strikethrough)
- Ordered and unordered lists
- Code blocks (JavaScript, Python, TypeScript, CSS, HTML, JSON, Bash, Rust)
- Tables
- Blockquotes
- Links
- Task lists
- Mixed content

### Files Updated for Google Docs → Markdown Conversion
**Core Converter:**
- `lib/markdown/converter.ts` - Complete rewrite with robust parsing
  - `convertGoogleDocToMarkdown()` - Main conversion function
  - `processParagraph()` - Handles text, headings, lists, images, links
  - `processTable()` - Converts Google Docs tables to Markdown tables
  - `processCodeBlocks()` - Detects and wraps code patterns
  - `fixHeadingHierarchy()` - Ensures proper heading levels
  - `cleanupWhitespace()` - Cleans up excessive whitespace
  - `validateMarkdown()` - Validates output for common issues
  - `normalizeListMarkers()` - Ensures consistent list formatting
  - `extractImagesFromDoc()` - Extracts inline images
  - `stripComments()` - Placeholder for comment handling

**Sync Integration:**
- `lib/sync/index.ts` - Updated to use enhanced converter functions
  - Added code block processing
  - Added heading hierarchy fix
  - Added list normalization
  - Added whitespace cleanup
  - Added markdown validation

**Test Scripts:**
- `test-converter.ts` - Comprehensive test suite for converter
- `convert-doc.ts` - Utility for converting Word docs to Google Docs format

### Document Selection & Discovery (NEW)
**Flow Change**: From folder-based selection to direct document selection

**Updated Files:**
- `lib/google/index.ts` - Added functions for listing all accessible docs/folders
  - `listAllAccessibleFolders()` - Lists all folders user has access to
  - `listAllAccessibleDocs()` - Lists all Google Docs across entire Drive
  - Updated `listFilesInFolder()` to handle root folder specially

- `lib/auth/index.ts` - Added `drive.file` scope for better file access permissions

- `components/forms/sync-config-form.tsx` - Changed from folder selection to document selection
  - Renamed `googleFolders` prop to `googleDocs`
  - Changed dropdown from "Google Drive Folder" to "Google Drive Document"

- `components/forms/sync-button.tsx` - Updated to trigger sync directly
  - Accepts `docId` and `docName` props
  - Calls `/api/sync` endpoint directly

- `app/settings/sync-configs/page.tsx` - Updated to fetch and display Google Docs
  - Uses `listAllAccessibleDocs()` instead of folder listing
  - Added tracked documents section with Sync buttons

- `app/api/sync-config/route.ts` - Updated to accept document selection
  - Changed from `folderId`/`folderName` to `docId`/`docName`
  - Creates tracked document entry in `documents` table

- `app/api/sync/route.ts` - Updated to auto-find sync config by document
  - Can find sync config by document ID if `configId` not provided

- `app/api/auth/disconnect/route.ts` - Fixed error handling for missing records
  - Added try-catch around delete operations

### Test Results
**Converter Test (test-converter.ts)** ✅ PASSED

Successfully converted a real Google Doc with:
- 100+ lines of markdown content
- Multiple heading levels (H1-H6)
- Text formatting (bold, italic, strikethrough)
- Ordered and unordered lists (nested)
- Code blocks (7 different languages)
- Tables (2 tables)
- Blockquotes (nested)
- Links (external, relative, with titles)
- Task lists
- Mixed content scenarios

**Output:** Clean markdown with proper formatting (prototype quality - ready for refinement)

**Google OAuth Reconnection Flow** ✅ PASSED

Successfully tested the reconnection flow for expired Google OAuth tokens:
1. User visits sync-configs page with expired token
2. Page detects `GoogleReconnectRequiredError` and shows reconnection card
3. User clicks "Reconnect Google" button
4. Existing Google account is disconnected (with sync cleanup)
5. User is redirected to Google OAuth with `prompt=consent`
6. User authorizes and gets new refresh token
7. User is redirected back to sync-configs page
8. Google Docs are successfully listed

**Sync History with Delete** ✅ PASSED

Successfully tested sync history display and deletion:
1. Sync history shows all sync operations for workspace
2. Each entry displays: doc title, status, commit SHA, file count, timestamp
3. Delete button with confirmation dialog works correctly
4. Sync history is properly deleted from database
5. UI updates immediately after deletion

### Database Tables (Live)
```
users              ✓ (9 columns)
sessions           ✓ (4 columns)
accounts           ✓ (11 columns, expires_at: integer)
verification_tokens ✓ (3 columns)
workspaces         ✓ (9 columns)
github_connections ✓ (7 columns)
google_connections ✓ (5 columns)
sync_configs       ✓ (12 columns)
sync_history       ✓ (11 columns)
documents          ✓ (8 columns)
api_keys           ✓ (6 columns)
audit_logs         ✓ (8 columns)
```

### Files Created/Updated in Phase 1
**Core Sync Logic:**
- `lib/sync/index.ts` - Main sync execution workflow
- `app/api/sync/route.ts` - Sync API endpoint
- `app/api/sync-config/route.ts` - Sync configuration API
- `app/api/documents/route.ts` - Documents listing API

**UI Components:**
- `components/forms/sync-config-form.tsx` - Create sync configurations
- `components/forms/document-picker.tsx` - Pick and sync Google Docs
- `components/forms/sync-button.tsx` - Updated to link to config page
- `components/ui/badge.tsx` - Badge component
- `components/ui/select.tsx` - Select dropdown component
- `components/ui/skeleton.tsx` - Skeleton loading component

### Database Tables (Live)
```
users              ✓ (9 columns)
sessions           ✓ (4 columns)
accounts           ✓ (11 columns, expires_at: integer)
verification_tokens ✓ (3 columns)
workspaces         ✓ (9 columns)
github_connections ✓ (7 columns)
google_connections ✓ (5 columns)
sync_configs       ✓ (12 columns)
sync_history       ✓ (11 columns)
documents          ✓ (8 columns)
api_keys           ✓ (6 columns)
audit_logs         ✓ (8 columns)
```

### Files Created/Updated in Phase 1
**Core Sync Logic:**
- `lib/sync/index.ts` - Main sync execution workflow (with auto token refresh)
- `app/api/sync/route.ts` - Sync API endpoint (updated for auto config detection)
- `app/api/sync-config/route.ts` - Sync configuration API (updated for document selection)
- `app/api/documents/route.ts` - Documents listing API
- `app/api/sync-history/[id]/route.ts` - API endpoint for deleting sync history

**UI Components:**
- `components/forms/sync-config-form.tsx` - Create sync configurations with document selection
- `components/forms/document-picker.tsx` - Pick and sync Google Docs (legacy)
- `components/forms/sync-button.tsx` - Updated to trigger sync directly
- `components/forms/disconnect-button.tsx` - Disconnect OAuth accounts
- `components/forms/reconnect-google-button.tsx` - One-click Google reconnection
- `components/forms/delete-sync-button.tsx` - Delete sync history with confirmation
- `components/forms/signin-button.tsx` - OAuth sign-in button
- `components/sync-history-list.tsx` - Client-side sync history list with delete support
- `components/ui/badge.tsx` - Badge component
- `components/ui/select.tsx` - Select dropdown component
- `components/ui/skeleton.tsx` - Skeleton loading component
- `components/ui/card.tsx` - Added CardFooter component
- `components/ui/dialog.tsx` - Radix UI Dialog component

**Pages:**
- `app/settings/sync-configs/page.tsx` - Sync configuration management (with reconnection flow)
- `app/dashboard/page.tsx` - Updated with sync stats, onboarding, workspace auto-creation
- `app/dashboard/syncs/page.tsx` - Updated with real sync history and delete support
- `app/dashboard/documents/page.tsx` - Updated with tracked documents
- `app/settings/page.tsx` - Updated with sync config link and disconnect buttons
- `components/layout/dashboard-nav.tsx` - Added sync configs nav item

**API Endpoints:**
- `app/api/auth/disconnect/route.ts` - Disconnect OAuth accounts endpoint (with sync cleanup)
- `app/api/sync-history/[id]/route.ts` - Delete sync history endpoint

**Library Updates:**
- `lib/auth/index.ts` - Added workspace auto-creation, `drive.file` scope, `prompt: "consent"`, `access_type: "offline"`
- `lib/github/index.ts` - Added `listGitHubRepos()` function
- `lib/google/index.ts` - Added `listAllAccessibleDocs()`, `listAllAccessibleFolders()`, `getValidGoogleAccessToken()`, `refreshGoogleAccessToken()`, `GoogleReconnectRequiredError`
- `lib/cloudinary/index.ts` - Installed cloudinary package
- `lib/markdown/converter.ts` - Ready for conversion
- `lib/markdown/frontmatter.ts` - Ready for front matter generation

### Known Issues & Fixes Applied
1. **OAuth redirect_uri_mismatch** → Fixed by adding correct callback URLs in Google Cloud Console
2. **OAuthAccountNotLinked** → Fixed by adding test users in Google OAuth consent screen
3. **expires_at type error** → Changed from `timestamp()` to `integer()` in schema (NextAuth stores Unix timestamps)
4. **Icon passing error** → Moved icon rendering into client component using lookup object
5. **TypeScript errors** → Fixed null/undefined handling in Google API, added CardFooter, fixed metadata type casting
6. **Remaining TypeScript issues** → Fixed by:
   - Adding `DocumentMetadata` interface and using `.$type<DocumentMetadata>()` for JSON columns
   - Updating toast hook to accept `React.ReactNode` for description
   - Using optional chaining for cleaner metadata access
7. **Missing workspace auto-creation** → Added workspace creation in:
   - `lib/auth/index.ts` - signIn callback creates workspace for new users
   - `app/dashboard/page.tsx` - Fallback workspace creation
   - `app/settings/page.tsx` - Fallback workspace creation
   - `app/settings/sync-configs/page.tsx` - Fallback workspace creation
8. **Expired Google OAuth tokens** → Added automatic token refresh and reconnection flow:
   - `GoogleReconnectRequiredError` - Custom error class for reconnection requirements
   - `getValidGoogleAccessToken()` - Automatically refreshes expired tokens
   - `ReconnectGoogleButton` - One-click reconnection UI
   - Sync execution auto-retries with refreshed token on "Invalid Credentials" error
   - Disconnect API now properly deletes sync_history before sync_configs

### TypeScript Issues - FIXED ✅
All remaining TypeScript issues have been resolved:

1. **`app/dashboard/documents/page.tsx`** - Fixed `unknown` type for metadata fields
   - **Solution**: Added `DocumentMetadata` interface in `db/schema.ts`
   - Used `.$type<DocumentMetadata>()` on the `jsonb` column for proper typing
   - Simplified code with optional chaining (`doc.metadata?.commitSha`)

2. **`components/forms/document-picker.tsx`** - Fixed toast description type
   - **Solution**: Updated `use-toast.ts` to accept `React.ReactNode` for description
   - Allows React elements in toast descriptions (links, icons, etc.)

3. **`lib/auth/index.ts`** - Sessions table schema fixed
   - **Solution**: Sessions table already had correct schema with `sessionToken` as primary key
   - Matches Drizzle adapter's expected schema

4. **Workspace auto-creation** - Fixed foreign key constraint errors
   - **Solution**: Added workspace creation in auth callback and page fallbacks
   - Ensures workspace exists before creating sync configurations

### Document Selection Flow - FIXED ✅
Changed from folder-based selection to direct document selection:

**Problem**: Google Drive API only showed files without sharing restrictions when using folder-based queries.

**Solution**:
1. Changed flow to select individual Google Docs directly during sync config creation
2. Added `listAllAccessibleDocs()` function that searches for all accessible docs across entire Drive
3. Updated OAuth scopes to include `drive.file` for better file access permissions
4. Documents are now tracked in the `documents` table when sync config is created
5. One-click sync from the tracked documents list

**Benefits**:
- Shows all accessible Google Docs (including shared files)
- Simpler user flow (no folder navigation needed)
- Direct sync from tracked documents list
- Better handling of complex sharing permissions

### Next Steps (Phase 2 - Polish & Reliability)
1. **Error Handling & Retries** - Add retry logic for transient errors
2. **Multi-Framework Support** - Template system for different SSGs
3. **Link Validation** - Check external links before sync
4. **Prettier Integration** - Auto-format with repo's Prettier config
5. **Change Detection** - Show diff of what changed since last sync
6. **Testing** - Unit tests for markdown conversion, integration tests for sync flow
7. **Image Handling** - Cloudinary integration for image upload and CDN URLs

### Known Issue - Database Clearing
**Issue**: When database is cleared (all records deleted), old JWT tokens still reference non-existent user IDs, causing foreign key constraint errors.

**Solution**: Sign out and sign back in to create a new user:
1. Visit `http://localhost:3000/api/auth/signout`
2. Go to homepage and sign in again
3. New user and workspace will be created automatically

**Root Cause**: The workspace auto-creation logic tries to create a workspace for a user ID that doesn't exist in the database (from old JWT token). The foreign key constraint `workspaces_owner_id_users_id_fk` fails because the user doesn't exist.

### Sync Flow (Complete)
```
1. User creates sync configuration (GitHub repo + Google Doc + framework)
   - Selects a Google Doc directly (no folder limitation)
   - Document is automatically tracked in documents table
2. User clicks "Sync" → POST /api/sync
3. Execute sync workflow:
   a. Fetch Google Doc via API
      - If "Invalid Credentials" error, automatically refresh access token
      - Retry with new token
   b. Convert to Markdown (tables, headings, code blocks)
   c. Process images (extract, upload to Cloudinary, update links)
   d. Generate front matter from template
   e. Create GitHub branch
   f. Commit file to repo
   g. Create Pull Request
   h. Log to sync_history table with docTitle
   i. Update documents table with tracking info
4. Return PR URL to user
```

### Google OAuth Token Refresh Flow
```
1. User visits sync-configs page with expired token
2. Page calls listAllAccessibleDocsByUserId(userId)
3. getValidGoogleAccessToken() checks if token is expired
4. If expired and no refresh token:
   - Throws GoogleReconnectRequiredError
   - Page shows "Reconnection Required" card
5. User clicks "Reconnect Google" button
6. Button:
   - Disconnects existing Google account via /api/auth/disconnect
   - Deletes sync_history, documents, and sync_configs
   - Redirects to Google OAuth with prompt=consent
7. User authorizes with Google
8. Google returns new access_token and refresh_token
9. User is redirected back to /settings/sync-configs
10. Page can now list Google Docs successfully
```

### Environment Variables Needed
```env
# Database
POSTGRES_URL=your_postgres_url

# OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Cloudinary (for image handling)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Testing the Sync Flow
1. Connect GitHub account (Settings → GitHub Connection)
2. Connect Google account (Settings → Google Connection)
3. Go to Settings → Sync Configurations
4. Create a new sync configuration:
   - Enter a configuration name
   - Select a GitHub repo
   - **Select a Google Drive document** (shows all accessible docs)
   - Choose framework (Next.js, Hugo, etc.)
   - Set output path (e.g., `content/posts/`)
   - Use default front matter template
   - Select Cloudinary as image strategy
5. The document appears in "Tracked Documents" section
6. Click "Sync" button next to the document
7. Check the PR on GitHub and sync history on dashboard

### What's NOT in v1 (Cut for MVP)
- ❌ AI-powered metadata generation
- ❌ Bi-directional sync
- ❌ Incremental section updates
- ❌ Scheduled/cron sync
- ❌ Analytics dashboards
- ❌ Enterprise SSO
- ❌ API access
- ❌ Migration tools
- ❌ Team collaboration features
- ❌ Content quality scoring

## Database Schema

```sql
-- Users
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar TEXT,
  created_at TIMESTAMP
)

-- Workspaces (teams)
workspaces (
  id UUID PRIMARY KEY,
  name TEXT,
  owner_id UUID REFERENCES users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMP
)

-- GitHub Connections
github_connections (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  repo_owner TEXT,
  repo_name TEXT,
  installation_id TEXT,
  access_token TEXT,
  created_at TIMESTAMP
)

-- Google Connections
google_connections (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  folder_id TEXT,
  refresh_token TEXT,
  created_at TIMESTAMP
)

-- Sync Configurations
sync_configs (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  github_connection_id UUID REFERENCES github_connections(id),
  google_connection_id UUID REFERENCES google_connections(id),
  name TEXT,
  framework TEXT, -- 'nextjs', 'hugo', 'docusaurus', etc.
  output_path TEXT, -- e.g., 'content/posts/'
  frontmatter_template TEXT, -- YAML template
  image_strategy TEXT, -- 'github', 'cloudinary', 'r2'
  image_path TEXT, -- e.g., 'public/images/'
  is_active BOOLEAN DEFAULT true,
  sync_schedule TEXT, -- 'manual', 'hourly', 'daily'
  created_at TIMESTAMP
)

-- Sync History
sync_history (
  id UUID PRIMARY KEY,
  sync_config_id UUID REFERENCES sync_configs(id),
  doc_id TEXT,
  doc_title TEXT,
  status TEXT, -- 'pending', 'success', 'failed'
  error_message TEXT,
  files_changed INTEGER,
  commit_sha TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
)

-- Documents (tracked docs)
documents (
  id UUID PRIMARY KEY,
  sync_config_id UUID REFERENCES sync_configs(id),
  google_doc_id TEXT UNIQUE,
  title TEXT,
  last_synced TIMESTAMP,
  last_modified TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP
)

-- API Keys (for API access)
api_keys (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  key_hash TEXT,
  name TEXT,
  last_used TIMESTAMP,
  created_at TIMESTAMP
)

-- Audit Logs
audit_logs (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES users(id),
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  created_at TIMESTAMP
)
```

## API Design

### Public API (REST)
```
POST /api/v1/sync
  - Trigger sync for a document
  - Body: { doc_id: string, config_id: string }

GET /api/v1/syncs
  - List sync history
  - Query: ?config_id=&status=&limit=&offset=

GET /api/v1/documents
  - List tracked documents
  - Query: ?config_id=&search=

POST /api/v1/webhook/google-drive
  - Webhook endpoint for Google Drive push notifications

GET /api/v1/analytics
  - Usage metrics
  - Query: ?workspace_id=&period=7d|30d|90d
```

### Internal API (Next.js Route Handlers)
```
/app/api/
  /auth/
    /callback/     # OAuth callback
    /session/      # Get current session

  /workspaces/
    /route.ts      # Create/list workspaces
    /[id]/route.ts # Get/update workspace

  /connections/
    /github/
      /route.ts    # Connect GitHub
      /callback/   # GitHub OAuth callback
    /google/
      /route.ts    # Connect Google
      /callback/   # Google OAuth callback

  /sync/
    /route.ts      # Trigger sync
    /[id]/route.ts # Sync status
    /webhook/      # Webhook endpoint

  /documents/
    /route.ts      # List documents
    /[id]/route.ts # Document details

  /billing/
    /route.ts      # Subscription management
    /portal/       # Stripe customer portal

  /api-keys/
    /route.ts      # Manage API keys
```

## Frontend Routes

```
/app/
  /dashboard/
    /page.tsx              # Main dashboard
    /syncs/               # Sync history
    /documents/           # Document list
    /analytics/           # Analytics dashboard

  /connections/
    /github/              # GitHub connection setup
    /google/              # Google Drive connection setup

  /settings/
    /workspace/           # Workspace settings
    /sync-configs/        # Sync configuration
    /team/                # Team management
    /billing/             # Billing portal
    /api-keys/            # API key management

  /onboarding/
    /page.tsx             # First-time user flow

  /marketing/
    /page.tsx             # Landing page
    /pricing/             # Pricing page
    /docs/                # Documentation
```

## Sync Flow (Detailed)

### 1. Trigger Sync
```
User clicks "Sync" → API endpoint → Background job (BullMQ)
```

### 2. Fetch from Google Docs
```
Google Docs API → Export as Markdown → Parse content
```

### 3. Process Images
```
Extract image URLs → Download → Optimize → Upload to Cloudinary/R2
→ Update Markdown links
```

### 4. Generate Front Matter
```
Template variables → Replace with actual values → Generate YAML
```

### 5. Format Content
```
Run Prettier → Validate links → Check heading hierarchy
```

### 6. Commit to GitHub
```
Create blob for images → Create tree for files → Commit → Push
```

### 7. Notify User
```
Update sync history → Send email/Slack notification
```

## Error Handling Strategy

### Retry Logic
- **Transient errors** (rate limits, network): Retry 3x with exponential backoff
- **Permanent errors** (auth, permissions): Show clear error to user
- **Partial failures**: Log which files succeeded/failed

### User Notifications
- **Email**: Daily digest of sync failures
- **In-app**: Toast notifications for immediate feedback
- **Slack**: Webhook integration for team alerts

### Logging
- **Structured logs**: JSON format with context
- **Log levels**: Info, Warn, Error, Debug
- **Retention**: 30 days for free, 90 days for pro

## Security Considerations

1. **OAuth Scopes** (minimal permissions):
   - GitHub: `repo` (read/write), `user:email`
   - Google: `https://www.googleapis.com/auth/drive.readonly`

2. **Token Storage**:
   - Encrypt refresh tokens at rest (AES-256)
   - Use environment variables for encryption key

3. **Rate Limiting**:
   - Per-user: 100 requests/hour (free), 1000/hour (pro)
   - Per-workspace: 1000 requests/hour

4. **Input Validation**:
   - Zod schemas for all API inputs
   - Sanitize file paths to prevent directory traversal

5. **CORS**: Restrict to your domain only

## Testing Strategy

### Unit Tests
- **Markdown conversion**: Verify Google Docs → Markdown accuracy
- **Front matter generation**: Template variable replacement
- **Image processing**: URL extraction and replacement

### Integration Tests
- **Google Docs API**: Mock API responses
- **GitHub API**: Mock commits and file operations
- **Sync flow**: End-to-end sync simulation

### E2E Tests (Playwright)
- **User flows**: Connect accounts → Configure sync → Trigger sync
- **Dashboard**: Navigation, data display
- **Billing**: Subscription flow

## Deployment & CI/CD

### GitHub Actions Workflow
```yaml
name: Deploy
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## Marketing & Launch Strategy

### Pre-Launch (Week 1-2)
1. **Landing Page**: Build waitlist with email capture
2. **Content Marketing**: Write "Why we built Markdly" blog post
3. **Community**: Post in relevant subreddits, Hacker News

### Launch (Week 3)
1. **Product Hunt**: Launch with prepared assets
2. **Indie Hackers**: Share journey
3. **Twitter**: Build in public, share progress

### Post-Launch (Month 1+)
1. **SEO Content**: "Google Docs to Markdown" tutorials
2. **Partnerships**: Partner with static site generator communities
3. **Referral Program**: Give 1 month free for each referral

## Monetization

### Pricing Tiers
- **Free**: 5 syncs/month, 1 repo, basic support
- **Pro ($19/mo)**: Unlimited syncs, 5 repos, priority support
- **Team ($49/mo)**: Unlimited repos, team collaboration, API access
- **Enterprise (Custom)**: Self-hosted, custom integrations, SLA

### Revenue Reality
**This is a $5k–20k MRR product, not a unicorn — and that's perfectly fine.**

Early customers will be:
- Small SaaS teams
- Open-source maintainers
- Indie founders
- DevRel teams

These people will pay $10–30/mo, not enterprise pricing early.

**Conservative Projections**:
- **Month 3**: 5 customers = $95/mo
- **Month 6**: 20 customers = $380/mo
- **Month 12**: 50 customers = $950/mo

**Expectations**:
- Slow early adoption
- Founder-led sales
- Hands-on support
- Validation comes from 10 paying customers in 3 months

## Success Metrics

### North Star Metric
- **Monthly Recurring Revenue (MRR)**

### Supporting Metrics
- **Activation Rate**: % of users who complete first sync
- **Retention**: % of users still active after 30/90 days
- **Sync Success Rate**: % of syncs that complete without errors
- **Customer Acquisition Cost (CAC)**: Marketing spend / new customers
- **Lifetime Value (LTV)**: Average revenue per customer

## Risk Mitigation

### Technical Risks
- **Google API changes**: Monitor API deprecations, have fallback strategies
- **GitHub rate limits**: Implement smart caching, batch operations
- **Image storage costs**: Set limits, use tiered pricing

### Business Risks
- **Competition**: Focus on automation and workflow, not just conversion
- **Market size**: Target enterprise teams, not individual developers
- **Churn**: Build features that become essential to workflow

### Execution Risks
- **Scope creep**: Stick to MVP features first
- **Burnout**: Set realistic timelines, take breaks
- **Technical debt**: Regular refactoring, good documentation

## Next Steps (Immediate)

### Before Writing Code
1. **Talk to 5 design partners** (docs teams, DevRel, marketing teams)
2. **Ask them to try a manual prototype**
3. **Watch where it breaks**

### Build Phase (2-week MVP)
1. **Set up project structure** (Next.js, Drizzle, Tailwind)
2. **Implement OAuth flows** (GitHub + Google)
3. **Build Google Docs → Markdown converter** (focus on tables, code blocks, images)
4. **Implement Cloudinary image handling** (primary differentiator)
5. **Create GitHub PR workflow**
6. **Build basic dashboard UI**
7. **Test with real users**

**Key**: If you build everything in the original plan, you'll burn out before validation. Stick to the ruthlessly cut MVP.

## Resources Needed

### Development
- **Time**: 2 weeks for true MVP (ruthlessly cut)
- **Time**: 6-8 weeks for full-featured product
- **Cost**: ~$100-200/month (Vercel, Cloudinary, database)

### Marketing
- **Time**: 2-3 hours/week for content/community
- **Cost**: Domain ($15/year), maybe $100-200 for initial ads

### Total First Month Cost**: ~$150-300

---

## Final Summary

### Positioning (Updated)
**"Turn Google Docs into GitHub-ready Markdown — automatically."**

Not: "Enterprise-grade content intelligence platform"

### Key Differentiator
**Image handling done right** — CDN integration, responsive images, no broken links. This alone is worth paying for.

### What Actually Matters
1. **Google Docs → Markdown conversion quality** (the hard part)
2. **Image handling** (the differentiator)
3. **Git-native workflow** (PRs, branches, commits)

### Success Criteria
**10 paying customers in 3 months** = validation

If not: pivot or iterate based on feedback.

### Remember
Your main enemy is **scope**, not competition.

Build the ruthlessly cut MVP first. Validate. Then expand.
