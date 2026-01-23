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

### 6. **Critical Bug Fixes** ✅
- **OAuth redirect_uri_mismatch**: Fixed by adding correct callback URLs to Google Cloud Console
- **OAuthAccountNotLinked**: Fixed by adding test users in Google OAuth consent screen
- **expires_at type mismatch**: Changed from `timestamp()` to `integer()` in schema (NextAuth stores Unix timestamps)

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

2. **Google Docs → Markdown** (3 days) - **The Hard Part**
   - Fetch doc content via API
   - Robust conversion (tables, code blocks, headings)
   - Image extraction and tracking

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

6. **Front Matter Templates** (1 day)
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

## ✅ Current Status: Authentication & Dashboard Complete

### What's Working Now
1. **✅ GitHub OAuth** - Connected and working
2. **✅ Google OAuth** - Connected and working
3. **✅ Database Schema** - All tables created with correct types
4. **✅ Dashboard UI** - Shows connection status
5. **✅ Settings Page** - Connection buttons for both providers
6. **✅ Protected Routes** - Auth required for dashboard/settings

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

### Known Issues & Fixes Applied
1. **OAuth redirect_uri_mismatch** → Fixed by adding correct callback URLs in Google Cloud Console
2. **OAuthAccountNotLinked** → Fixed by adding test users in Google OAuth consent screen
3. **expires_at type error** → Changed from `timestamp()` to `integer()` in schema (NextAuth stores Unix timestamps)
4. **Icon passing error** → Moved icon rendering into client component using lookup object

### Next Steps (Immediate)
1. **Implement Google Docs API integration** - Fetch documents
2. **Implement GitHub API integration** - Create files and PRs
3. **Implement Cloudinary integration** - Upload images
4. **Build sync execution logic** - Connect all pieces together
5. **Add sync history tracking** - Log operations to database
6. **Add error handling** - Retry logic and user notifications

### Files to Implement Next
- `lib/google/index.ts` - Google Docs API wrapper (ready, needs testing)
- `lib/github/index.ts` - GitHub API wrapper (ready, needs testing)
- `lib/cloudinary/index.ts` - Cloudinary wrapper (ready, needs testing)
- `lib/markdown/converter.ts` - Google Docs → Markdown (ready, needs testing)
- `lib/markdown/frontmatter.ts` - Front matter templates (ready, needs testing)
- `app/api/sync/route.ts` - Sync endpoint
- `app/dashboard/syncs/page.tsx` - Sync history display
- `components/forms/sync-config-form.tsx` - Sync configuration

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
