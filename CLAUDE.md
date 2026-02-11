# MoltJob — Claude Code Context

## What This Is

MoltJob is an agent-first job platform. Humans register, upload a resume, get an API key, and hand it to their AI agent. The agent autonomously browses jobs, applies, messages employers, and schedules interviews. Employers post jobs and interact with candidate agents.

## Tech Stack

- **Framework:** Next.js 15.1.0, React 19, TypeScript 5.7
- **Database:** PostgreSQL (Neon in production) with `pg` driver
- **Auth:** JWT (7-day expiry) + API keys (`aj_live_*` prefix, bcrypt hashed)
- **Styling:** Tailwind CSS 4.0 with custom dark theme
- **Payments:** Coinbase Commerce (crypto, $29 one-time for seekers)
- **Deployment:** Vercel + Neon PostgreSQL

## Project Structure

```
lib/                  # Shared server utilities
  db.ts               # Pool, query<T>(), queryOne<T>()
  middleware.ts        # withAuth(), withRateLimit(), signToken(), verifyToken()
  apikeys.ts          # createApiKey(), validateApiKey(), revokeApiKey()
  activity.ts         # logActivity() → agent_activity_log table
  matching.ts         # matchJobsForSeeker() — weighted scoring (skills 40%, salary 30%, exp 20%, location 10%)
  ratelimit.ts        # In-memory sliding window rate limiter
  coinbase.ts         # createCharge() — Coinbase Commerce API
  webhook.ts          # verifyCoinbaseWebhook() — HMAC-SHA256
  types.ts            # All TypeScript interfaces
  useAuth.ts          # React hook: token/user in localStorage, fetchWithAuth()

pages/api/v1/         # Agent-facing API (primary)
  seeker/profile.ts   # GET/POST/PUT seeker profile
  jobs/               # GET browse jobs, GET job by id
  applications/       # GET list, POST apply (402 if unpaid, 3/day limit)
  employer/           # jobs, applications, profile management
  messages/           # Polling, sending, marking read
  ratings.ts          # POST rate seeker, GET ratings
  payments/           # create-charge, status, webhook
  skill.md.ts         # Public markdown API docs for agents (no auth)

pages/api/            # Legacy internal routes (auth, dashboard data)
pages/dashboard/      # seeker.tsx, employer.tsx
pages/onboarding/     # seeker.tsx, employer.tsx
pages/                # index.tsx (landing), login.tsx, register.tsx

migrations/           # SQL migrations (run manually against Neon)
  001_agent_api.sql   # API keys, activity log, message read_at
  002_payments.sql    # Payments table for Coinbase Commerce

schema.sql            # Full base schema (run first)
seed.sql              # Test data
```

## Database Tables

`users` → `job_seekers` / `employers` → `job_postings` → `applications` → `conversations` → `messages`

Plus: `api_keys`, `agent_activity_log`, `ratings`, `payments`

Key fields:
- `job_seekers.has_paid` — payment gate for applications (toggleable manually for free grants)
- `api_keys.key_prefix` — first 8 chars for fast lookup before bcrypt check
- `applications.match_score` — 0-100, calculated on apply via matching algorithm

## API Patterns

All authenticated routes use `withRateLimit` (wraps `withAuth`). Pattern:

```typescript
import type { NextApiResponse } from 'next'
import { withRateLimit, type AuthenticatedRequest } from '@/lib/middleware'
import { query, queryOne } from '@/lib/db'

export default withRateLimit(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  // 1. Role check: req.user.role
  // 2. Fetch profile: queryOne<JobSeeker>('SELECT * FROM job_seekers WHERE user_id = $1', [req.user.userId])
  // 3. Method routing: if (req.method === 'GET') / 'POST' / etc.
  // 4. Return errors as: { error: string, code: string }
  // 5. Log with logActivity()
})
```

Error response codes: `UNAUTHORIZED` (401), `PAYMENT_REQUIRED` (402), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (400), `DUPLICATE_APPLICATION` (409), `DAILY_LIMIT_REACHED` (429), `RATE_LIMIT_EXCEEDED` (429), `JOB_NOT_ACTIVE` (400).

Pagination pattern: `{ data: T[], pagination: { page, per_page, total, total_pages } }`

## Auth Flow

- **Browser:** JWT stored in localStorage → `Authorization: Bearer <jwt>` via `useAuth()` hook
- **Agent:** API key → `Authorization: Bearer aj_live_<key>` → validated via bcrypt in `lib/apikeys.ts`
- Both paths converge in `withAuth()` which sets `req.user: AuthPayload` and `req.authMethod`

## Payment Flow

1. Seeker clicks "Pay $29" → `POST /api/v1/payments/create-charge` → Coinbase hosted checkout
2. Coinbase webhook `charge:confirmed` → `POST /api/v1/payments/webhook` → sets `has_paid = true`
3. `POST /api/v1/applications` returns 402 if `!seeker.has_paid`
4. Manual override: `UPDATE job_seekers SET has_paid = true WHERE user_id = '...'`

## Styling

Dark theme. Key Tailwind colors:
- `bg-surface` (#08080d), `bg-surface-2` (#111119), `bg-surface-3` (#1a1a26)
- `text-accent` / `bg-accent` (#00e87b — bright green)
- `text-dim` (#64648a), `border-bdim` (rgba white 5%)
- Fonts: Outfit (display), DM Sans (body), JetBrains Mono (code)

## Environment Variables

```
DATABASE_URL          # PostgreSQL connection string (Neon)
JWT_SECRET            # Secret for signing JWTs
NEXT_PUBLIC_APP_URL   # Base URL (e.g. https://agentjob-eight.vercel.app)
COINBASE_COMMERCE_API_KEY
COINBASE_COMMERCE_WEBHOOK_SECRET
```

## Common Tasks

- **Run migration:** `node -e "..." < migrations/00X.sql` (no psql installed locally; use Node pg client)
- **Grant free access:** `UPDATE job_seekers SET has_paid = true WHERE user_id = '...'`
- **Build:** `npm run build`
- **Dev:** `npm run dev`
- **Reset DB:** `npm run db:reset` (runs schema.sql + seed.sql)
