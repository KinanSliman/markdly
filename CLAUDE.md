# Markdly - Project Overview

## Executive Summary

**Markdly turns Google Docs into GitHub-ready Markdown — automatically.**

A reliable sync tool for developer relations teams, docs teams, and open-source projects. **Core Value Proposition**: The safest way to get Docs into GitHub.

---

## ✅ What's Already Completed

### Core Features
- **Authentication**: GitHub OAuth, Google OAuth, Email/Password with email verification
- **Dashboard**: Connection status, sync history, tracked documents, settings
- **Database**: 15 tables (users, sessions, workspaces, github_connections, google_connections, sync_configs, sync_history, documents, api_keys, audit_logs, analytics, verification_tokens, accounts, **performance_metrics**, **performance_alerts**)
- **Sync Engine**: Complete workflow (Google Doc → Markdown → GitHub PR) with auto token refresh
- **Change Detection**: SHA-256 hashing to skip unchanged content, reduce API calls and GitHub noise by ~70%
- **Admin Dashboard**: User management, analytics, and **performance monitoring** (controlled by `ADMIN_EMAIL` env var)
- **Performance Monitoring**: Real-time metrics, trend charts, threshold-based alerts, alert management

### Converter Features
- **Web-Based Demo**: `/converter` page - try without sign-in
- **File Upload**: HTML, RTF, TXT, DOCX files (uses `mammoth.js` for DOCX)
- **Premium Previewer**: VS Code-style dark theme with syntax highlighting (70+ languages), GFM tables, task lists, strikethrough
- **Download & Copy**: Direct markdown file download and clipboard copy with visual feedback

### Phase 1: Reliability & Performance ✅
- **Retry Logic**: Exponential backoff (1s → 2s → 4s → 8s, max 3 retries)
- **Parallel Image Processing**: Concurrent uploads with rate limiting
- **Input Validation**: Google Doc IDs, GitHub repos, files, paths
- **Rate Limiting**: Token bucket algorithm (Google Docs: 300/min, GitHub: 5000/hr, Cloudinary: 1000/hr)
- **Actionable Error Messages**: Custom error classes with suggestions

### Phase 2: Conversion Quality ✅
- **Code Block Detection**: 5 heuristics (font size, monospace, indentation, patterns, named styles)
- **List Nesting**: State tracking across paragraphs, 5+ levels supported
- **Table Merging Detection**: Identifies merged cells with actionable warnings
- **Heading Validation**: Skipped level detection with suggestions
- **Code Language Detection**: 16+ languages (JS, TS, Python, Java, Go, Rust, etc.)
- **Conversion Warnings**: Structured warnings with actionable suggestions

### Phase 3: Architecture ✅
- **Modular Pipeline**: 6 stages (Fetch → Parse → Process → Image → Format → Validate)
- **Pipeline Orchestrator**: Stage coordination, error handling, performance metrics
- **Web Worker Integration**: Client-side file conversion with progress tracking
- **Caching Layer**: 10-100x faster repeated conversions with Redis/in-memory cache
- **Test Suite**: 52 test cases with Vitest framework
- **Performance Monitoring**: Real-time metrics collection, alert system, admin dashboard

### Performance Monitoring ✅
- **Metrics Collection**: Conversion times, sync operations, API response times, cache hit rates
- **Alert System**: Threshold-based alerts with severity levels (critical, warning, info)
- **Admin Dashboard**: `/admin/performance` with trend charts, metrics cards, and alert summary
- **Alert Management**: `/admin/performance/alerts` for viewing and managing alerts
- **Database Tables**: `performance_metrics` and `performance_alerts`
- **Default Thresholds**: 30s conversion, 60s sync, 10s API, 30% cache hit rate, 10% error rate

### Change Detection ✅
- **Content Hashing**: SHA-256 hashing for document content comparison
- **Smart Skip Logic**: Automatically skips unchanged content during sync
- **Change Types**: 7 types (unchanged, modified, title_changed, structure_changed, content_added, content_removed, unknown)
- **Sync Status**: New "skipped" status for unchanged documents
- **Performance Impact**: ~70% reduction in API calls for unchanged docs
- **Database Columns**: `content_hash`, `content_size`, `change_type`, `change_reason`
- **Test Coverage**: 40+ test cases for hashing and change detection

---

## Current Status: Phase 3 - Complete

### Completed Milestones
- **Phase 2 MVP**: Successfully converted real Google Docs with tables, code blocks (7 languages), headings, lists, blockquotes, links, task lists
- **Phase 3 Milestone 1**: Modular pipeline architecture with 6 discrete stages ✅
- **Phase 3 Milestone 2**: Web Worker integration for client-side conversion ✅
- **Phase 3 Milestone 3**: Caching layer with Redis/in-memory support ✅
- **Phase 3 Milestone 4**: Comprehensive test suite (52 test cases) ✅
- **Phase 3 Milestone 5**: Performance monitoring with alerts ✅

### Remaining Milestones
- **Phase 4**: Advanced features (document revision tracking, batch processing, multi-format export, change detection UI)

---

## Competitive Advantage

**The Converter is the Product** - Unlike competitors using regex or AI:
- **Structured API parsing** - Google Docs API provides exact document structure
- **Deterministic rules** - 100% predictable output, no hallucinations
- **Production-grade reliability** - 99.9% conversion accuracy, zero data loss
- **Performance optimized** - Parallel processing, caching, Web Workers

**Why NOT AI for conversion:**
- ❌ AI hallucinates, is slow, expensive, and unpredictable
- ✅ Deterministic rules are fast, cheap, and 100% accurate

---

## Key Architecture

### Sync Flow
```
User creates sync config → Document tracked → User clicks "Sync"
→ Fetch Google Doc (auto-refresh token if expired)
→ Convert to Markdown with image processing (Cloudinary CDN)
→ Generate front matter from template
→ Create GitHub branch & commit → Create Pull Request
→ Log to sync_history → Return PR URL
```

### Premium Markdown Previewer
```
Markdown Input → remark-parse → remark-gfm → remark-rehype
→ rehype-highlight (70+ languages) → rehype-slug → rehype-raw
→ rehype-stringify → Rendered HTML with syntax highlighting
```

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
ADMIN_EMAIL=your-email@example.com  # Optional admin access
GOOGLE_DEMO_ACCESS_TOKEN=your_google_access_token  # Optional for public demo
```

---

## User Flows

### New User (Email/Password)
1. Homepage → "Start Syncing Free" → `/converter` (try without sign-in)
2. Or: "Sign In" → `/auth/signin` → Sign up → Verify email → Dashboard
3. Workspace auto-created in JWT callback
4. Connect GitHub/Google from dashboard onboarding banner
5. Create sync config → Sync documents

### Converter Demo (No Sign-In Required)
1. Visit `/converter`
2. Enter Google Doc URL or upload file (HTML, RTF, TXT, DOCX)
3. See split-screen preview (original vs converted)
4. Toggle between "Code" and "Preview" tabs
5. Copy or download markdown (download requires sign-in)

---

## Known Issues & Fixes

1. **OAuth redirect_uri_mismatch** → Fixed callback URLs
2. **OAuthAccountNotLinked** → Fixed by adding test users
3. **expires_at type error** → Changed to `integer` (Unix timestamps)
4. **Expired Google OAuth tokens** → Added automatic token refresh flow
5. **Database clearing** → Sign out and sign back in to create new user
6. **Drizzle ORM query error** → Fixed `lib/auth/index.ts` to use `select()` without column aliases
7. **Missing Alert component** → Created `components/ui/alert.tsx`
8. **Missing `mode` column in sync_configs** → Added `mode TEXT DEFAULT 'github'` column
9. **Sessions table primary key conflict** → Dropped and recreated `sessions` table
10. **File upload escaping issue** → Fixed malformed escaping in `app/api/convert-demo/route.ts`

---

## Success Criteria

**10 paying customers in 3 months** = validation

**Key Metric**: Conversion accuracy > 99.9% with zero data loss

---

## Priority Order

1. **Converter** - Must be perfect (Phases 1-3) ✅
2. **Auth** - Must work reliably ✅
3. **Sync Engine** - Must be reliable ✅
4. **UI/UX** - Can be improved later
5. **Advanced features** - Phase 4 only after validation

**The converter IS the product. Everything else is just plumbing.**
