# BrandFit

BrandFit is an AI-assisted brand governance platform for marketing and content teams.
Organizations set custom brand rules, approved factual claims, and preferred vocabulary.
Writers draft copy and receive instant AI feedback citing specific brand rules and exact text quotes.
Creators retain full agency to accept, edit, or reject suggestions before submitting for approval.
Designated reviewers inspect submissions and audit trails to maintain consistent brand integrity.

---

## Live Demo

- **Production URL**: [https://brandfit.vercel.app](https://brandfit.vercel.app)

---

## Demo Accounts

All demo accounts share the same password and are pre-joined to the demo company (**FreshBrew Coffee**):

| Role | Email | Password | Join Code |
| :--- | :--- | :--- | :--- |
| **Employer** | `employer@demo.com` | `demo1234` | `DEMO01` |
| **Reviewer** | `reviewer@demo.com` | `demo1234` | `DEMO01` |
| **Employee** | `employee@demo.com` | `demo1234` | `DEMO01` |

> [!NOTE]
> Demo account constants are configured in [`lib/demo.ts`](lib/demo.ts).

---

## How to Run Locally

Follow these six steps to run BrandFit on your local machine:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Yugyadav-28/brandfit.git
   cd brandfit
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Supabase**:
   Create a project on [Supabase](https://database.new) and run the database schema migrations to create the required tables (`companies`, `memberships`, `rules`, `facts`, `terms`, `submissions`, `versions`, `findings`, `comments`, `audit_log`) with Row Level Security enabled.

4. **Configure environment variables**:
   Create a `.env.local` file in the root directory and add the required environment variables (see list below).

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Open the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser. Sign in using one of the demo credentials or create a new account.

---

## Environment Variables

Only the following environment variable names are required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

*(Do not commit secret keys to version control. Set client keys with `NEXT_PUBLIC_` and server keys without prefix.)*

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Server Actions, Route Handlers, Partial Prerendering)
- **Language**: [TypeScript](https://www.typescriptlang.org) (Strict mode)
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com), [Radix UI](https://www.radix-ui.com), [Lucide React](https://lucide.dev)
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL database, Auth, cookie sessions via `@supabase/ssr`, Admin client via `SUPABASE_SECRET_KEY`)
- **AI Engine**: [Google Gemini API](https://ai.google.dev) via official `@google/genai` SDK
- **Validation**: [Zod](https://zod.dev)

---

## Folder Map

```
brandfit/
├── app/                           # Next.js App Router routes & layouts
│   ├── actions/                   # Server Actions (company, guidelines, members)
│   ├── api/                       # REST API Route Handlers
│   │   ├── findings/[id]/         # PATCH finding decisions
│   │   └── submissions/           # Submission creation, versions, review runs, decisions, comments
│   ├── auth/                      # Authentication routes (login, sign-up, confirm, post-login)
│   ├── company/                   # Company workspace management
│   │   ├── audit/                 # Audit trail browser (Reviewer & Employer)
│   │   ├── guidelines/            # Brand Rules, Facts, and Terms manager (Employer)
│   │   ├── members/               # Team member management & join codes (Employer)
│   │   └── new/                   # Create company flow
│   ├── dashboard/                 # Analytics, waiting review queue, team activity
│   ├── disclosure/                # AI transparency policy & model disclosure
│   ├── home-start/                # Post-login routing for users without a company
│   ├── join/                      # Join company with 6-character code
│   ├── my/                        # Employee submissions list & status tracking
│   ├── review/                    # Reviewer approval queue & submission inspector
│   ├── submit/                    # Content submission & AI review triage interface
│   ├── layout.tsx                 # Root layout with Nav and Footer
│   └── page.tsx                   # Public landing page with demo steps
├── components/                    # Shared React UI components
│   ├── ui/                        # Radix + Tailwind primitive components (Button, Input, Card, etc.)
│   ├── ai-badge.tsx               # Standardized AI suggestion badge
│   ├── nav.tsx                    # Server-side navigation resolver
│   └── nav-client.tsx             # Responsive mobile navbar with active page indicator
├── docs/                          # Technical specifications & documentation
│   ├── ARCHITECTURE.md            # System architecture, pipeline, database, and decisions
│   ├── CONTRACT.md                # Shared agent API and ownership contracts
│   └── PRIVACY_SECURITY.md        # Data isolation, security boundaries, and oversight
├── lib/                           # Core utilities and business logic
│   ├── review/                    # Review engine (ruleChecks, aiReview, rateLimit, runReview)
│   ├── supabase/                  # Supabase clients (browser, server, admin)
│   ├── audit.ts                   # Immutable audit logging helper
│   ├── auth.ts                    # Authentication & role-check helpers (requireUser, requireMember)
│   ├── demo.ts                    # Demo account constants
│   └── types.ts                   # Domain types (Role, Finding, SubmissionStatus, AuditAction)
├── scripts/                       # Local testing & verification scripts
└── seed/                          # Demo brand kits (FreshBrew Coffee sample JSON)
```

---

## Roles and Workflow

### User Roles

1. **Employer**:
   - Owns the company workspace.
   - Configures brand guidelines: rules, approved facts, and vocabulary terms.
   - Manages team members, switches roles between employee and reviewer, and regenerates join codes.
   - Accesses dashboard analytics, the audit log, and can approve submissions.
2. **Reviewer**:
   - Inspects content sent for review.
   - Approves submissions or requests changes with review notes and feedback.
   - Inspects the full immutable audit trail.
3. **Employee**:
   - Joins via 6-character join code.
   - Submits content drafts for automated compliance scanning.
   - Reviews findings and accepts, edits, or rejects suggestions before sending for review.
   - Tracks submission history and status updates.

### End-to-End Workflow

```
[Employee/Creator]               [BrandFit Engine]                [Reviewer/Employer]
        │                                │                                 │
  1. Writes copy                         │                                 │
  2. Runs Review ───────────────────────►│                                 │
        │                        • Rule Checks (Regex)                     │
        │                        • Gemini AI Scan                          │
        │                        • Citation Validation                     │
        │                        • Deduplicate & Rank                      │
  3. Receives findings ◄─────────────────┘                                 │
  4. Triages findings                    │                                 │
     (Accept / Edit / Reject)            │                                 │
  5. Sends for review ───────────────────┼────────────────────────────────►│
        │                                │                     6. Inspects submission
        │                                │                     7. Approves or Requests Changes
        │◄───────────────────────────────┼─────────────────────────────────┘
  8. If changes requested:               │
     Edits draft (creates v2)            │
     Re-runs check & resubmits           │
```

---

## Current Status and Roadmap

### What is Done (Built & Verified in Code)
- [x] Multi-tenant workspace creation with random 6-character join codes (excluding ambiguous characters `0, O, 1, I, L`).
- [x] Role-based authentication and navigation (`employer`, `reviewer`, `employee`).
- [x] Brand Guidelines management (CRUD for Rules, Facts, and Terms) with one-click Sample Brand Kit import.
- [x] Team member management (role elevation/demotion, member removal, join code regeneration).
- [x] Hybrid review engine: local deterministic rule & terminology checks followed by Google Gemini API checks.
- [x] Strict citation and exact-quote validation (hallucinated codes and inaccurate quotes are automatically discarded).
- [x] Finding triage UI: creators accept, edit replacement text, or reject findings with notes.
- [x] Multi-version content revisions (`versions` tracking).
- [x] Review queue with approval and change request workflow including feedback notes.
- [x] Dashboard with waiting queue, status metrics, and repeated mistakes tracker.
- [x] Comprehensive, write-only audit trail logging all actions (`audit_log`).
- [x] Rate limiting (in-memory sliding window: 10 scans / 10 minutes) and hard 20-second timeout protection.
- [x] Public AI disclosure page detailing model usage, data flows, and boundaries.

### What is Planned (Future Enhancements)
- [ ] *Planned*: Direct integrations with external publishing platforms (WordPress, Webflow, LinkedIn, Ghost).
- [ ] *Planned*: Multi-company workspace switcher in the top navigation bar.
- [ ] *Planned*: Real-time collaborative drafting in the submission editor.
- [ ] *Planned*: Image and visual media OCR scanning for brand color and logo compliance.
- [ ] *Planned*: Exportable compliance reports (PDF / CSV) for enterprise audits.

---

## Known Limitations

- **AI Model Fallibility**: The Google Gemini model can miss subtle stylistic issues or return false positives. AI suggestions are advisory and never applied automatically.
- **Provider Free-Tier Terms**: Requests on Gemini API free tiers may be subject to provider product improvement terms. Only fictional or non-confidential content should be tested in this demo environment.
- **Review Rate Limit**: To protect API quotas, review scans are capped at 10 requests per user per 10-minute sliding window.
- **Single Active Company View**: Sessions currently resolve to the primary membership role. Users belonging to multiple companies default to their employer or reviewer workspace.
