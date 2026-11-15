# BrandFit

BrandFit is an AI-assisted brand governance platform for marketing and content teams.
Organizations set custom brand rules, approved factual claims, vocabulary, and color palettes.
Creators submit text, documents (PDF, DOCX), or images (PNG, JPG, WebP) for instant compliance checks.
A hybrid review engine pairs local deterministic checks with Google Gemini to cite exact rules and quotes.
Humans stay in full control: creators triage suggestions, and designated reviewers provide final sign-off.

---

## Live Link

- **Production Deployment**: [https://brandfit.vercel.app](https://brandfit.vercel.app)

---

## How to Try It in Two Minutes

Test the complete end-to-end workflow using our pre-configured demo company (**FreshBrew Coffee**, join code: `DEMO01`):

| Role | Email | Password | Join Code | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Employer** | `employer@demo.com` | `demo1234` | `DEMO01` | Manage brand guidelines, team roles, and view analytics |
| **Reviewer** | `reviewer@demo.com` | `demo1234` | `DEMO01` | Inspect submissions in the review queue and approve drafts |
| **Employee** | `employee@demo.com` | `demo1234` | `DEMO01` | Draft content, run AI checks, and triage findings |

> [!NOTE]
> Demo account configurations and sample credentials are defined in [`lib/demo.ts`](lib/demo.ts).

### Walkthrough Steps

1. **Log in as an Employee**:
   Visit [/auth/login](https://brandfit.vercel.app/auth/login) and sign in as `employee@demo.com` with password `demo1234`.
2. **Submit Content for Review**:
   Navigate to **Submit** (`/submit`). Either type marketing copy into the text editor, upload a document (PDF/Word), or upload an image with alt text. Click **Check draft** (or **Check document** / **Check image**).
3. **Triage Findings**:
   Review the flagged findings. Each finding cites the exact brand rule code, quotes the offending text, and suggests a compliant rewrite. Click **Accept** to apply a replacement, **Edit** to customize the wording, or **Reject** with a reason.
4. **Send for Review**:
   Click **Send for review** to place the submission into the company review queue.
5. **Approve as Reviewer**:
   Log out, sign in as `reviewer@demo.com` (password `demo1234`), and navigate to **Review** (`/review`). Open the submission, inspect the triage notes and version diff, and click **Approve post** or **Request changes**.

---

## Features

### 1. Review Engine
- **Deterministic Rule Checks**: Instant regex-based matching for prohibited terms, unapproved claims, and style requirements.
- **Hybrid Semantic Retrieval**: For guideline libraries with more than 25 items, `lib/retrieval/retrieve.ts` uses Google Gemini vector embeddings (`gemini-embedding-001`) and PostgreSQL `pgvector` HNSW index similarity search to identify relevant rules. Guideline kits with 25 or fewer items load completely for deterministic coverage.
- **AI-Powered Analysis**: Google Gemini API (`gemini-2.5-flash`) analyzes content for tone, nuance, claim veracity, and complex guidelines using structured JSON schemas.
- **Citation & Exact-Quote Validation**: Every finding must cite a valid rule or fact code, and quoted snippets must match content verbatim. Hallucinated or inaccurate citations are automatically discarded.
- **Safe Suggestion Sanitization**: Automated replacement suggestions are sanitized to prevent the AI from introducing unapproved superlatives, guarantees, or unsourced claims.
- **Rate Limiting & Timeout Guards**: In-memory sliding window rate limits review scans to 10 requests per user per 10 minutes (`lib/review/rateLimit.ts`), backed by a 60-second execution deadline.

### 2. Workflow & Collaboration
- **Four Granular Roles**:
  - `employer`: Creates workspaces, configures guidelines, manages members, inspects audit logs, and approves content.
  - `reviewer`: Inspects submitted drafts, reviews findings triage, and approves or requests changes.
  - `authorised_reviewer`: Specialized reviewer with authority to approve sensitive rules and resolve escalations.
  - `employee`: Drafts content, runs compliance scans, triages findings, and responds to review comments.
- **Submission Status Lifecycle**: Tracks content through `draft` $\rightarrow$ `in_review` $\rightarrow$ `escalated` $\rightarrow$ `approved` or `changes_requested`.
- **Sensitive Rule Escalation**: Rules flagged with `needs_escalation` automatically route submissions to `escalated` status, requiring sign-off by an authorized reviewer or employer.
- **Version History**: Supports multiple version iterations (`versions` table) per submission as authors make edits in response to reviewer feedback.
- **Finding Triage**: Creators choose to accept, edit, or reject individual findings before formal submission.
- **Threaded Review Comments**: Reviewers and creators collaborate directly on submissions with timestamped comments.
- **Zero-Friction Team Onboarding**: 6-character alphanumeric join codes allow team members to join without manual email invitations.

### 3. Guidelines Management
- **Brand Rules**: Manage rules by category (`tone`, `terminology`, `claims`, `facts`, `visual`, `accessibility`), rule code, title, instructions, and sensitivity/escalation status.
- **Approved Facts**: Maintain verified factual statements with source citations and last-verified timestamps to catch incorrect claims and numbers.
- **Preferred & Avoided Terminology**: Dictionary of preferred terms paired with words to avoid and usage guidance.
- **Brand Colours**: Configure brand palette entries with hex codes (`#RRGGBB`), custom names, and visual swatches.
- **1-Click Sample Brand Kit**: Seed a complete brand governance kit (rules, facts, terms) with a single click.
- **Automated Vector Embeddings**: Embeddings are updated in the background upon creating or editing rules and facts.

### 4. Uploads & Multi-Modal Processing
- **Multi-Format Upload Panel**: Dedicated tabs for Text, Document, and Image submissions.
- **Document Text Extraction**: Extracts text from PDF (`unpdf`) and Word `.docx` (`mammoth`) up to 4 MB and checks up to the first 10,000 characters.
- **Document Accessibility Checks**: Automatically evaluates heading hierarchy (`h1`–`h6`), counts embedded images, and checks for missing alt text.
- **Image Palette Extraction**: Analyzes uploaded images (PNG, JPG, WebP up to 4 MB) using `sharp`, shrinks to 64x64, groups pixels into 16-level buckets, and identifies dominant colors.
- **Color Compliance Engine**: Calculates WCAG 2.1 contrast ratios and CIE76 ($\Delta E$) color differences against the company's brand palette (`lib/media/color.ts`).
- **Alt Text Verification**: Validates alt text length and descriptiveness, flags generic placeholder terms ("photo", "logo", "banner"), and uses Gemini Vision to evaluate image tone and alt text quality.
- **Private Storage**: Stores uploaded images in a private Supabase Storage bucket (`uploads`) accessible only by authorized company members.

### 5. Insights & Analytics
- **Analytics Dashboard (`/dashboard/insights`)**: Interactive charts with date range filtering (Last 7 days, Last 30 days, All time).
- **Most Broken Rules**: Identifies the top brand rules violated in the initial version of submissions.
- **Repeat Mistakes by Author**: Analyzes repeat mistake rates per author and lists repeated rule codes appearing in two or more posts.
- **Rule Rejection Rates & Clarity Warnings**: Calculates rejection percentages for rules with $\ge 5$ decided findings; flags rules with $\ge 40\%$ rejection rate as "possibly unclear".
- **AI Rule Rewrites**: Generates clearer, more actionable rule wording based on real feedback reasons and rejected quotes from writers.
- **Trends Over Time**: Graphs findings per submission over time to track whether brand compliance is improving.
- **Team Activity Dashboard (`/dashboard`)**: Displays submission volumes, initial mistake counts, triage breakdown (accepted, edited, rejected), and repeated mistakes per team member.

### 6. Security & Governance
- **Row Level Security (RLS)**: Enforced across all PostgreSQL tables; non-admin queries are strictly restricted to the caller's `company_id`.
- **Server-Only Database Access**: Browser clients have no direct database access; queries run through `createAdminClient()` using `SUPABASE_SECRET_KEY` strictly on the server after authentication checks.
- **Authorization Guards**: Route handlers and server actions enforce authentication via `requireUser()` and workspace access via `requireMember()`.
- **Input Validation**: All server action and API route inputs are validated using Zod schemas with trimmed strings, length limits, allowed enums, and hex color validation.
- **Prompt Injection Defense**: Submitted copy and extracted document texts are treated strictly as untrusted data, never as system instructions.
- **Immutable Audit Logging**: Write-only audit trail (`audit_log`) captures all system events, company updates, rule changes, reviews, and decisions.
- **Plain Text Rendering**: User-generated content (titles, body content, comments, rejection reasons, company names, alt text) is rendered strictly as plain text, eliminating XSS vectors.

---

## How to Run Locally

Follow these numbered steps to run BrandFit on your local development machine:

### 1. Prerequisites
- **Node.js**: Node 20+ (Node 22+ recommended for native TypeScript strip-types execution).
- **npm**: Version 10 or newer.
- **Supabase Account**: A project on [supabase.com](https://supabase.com) (free tier is fully supported).
- **Google Gemini API Key**: An API key from [Google AI Studio](https://aistudio.google.com).

### 2. Clone the Repository
```bash
git clone https://github.com/Yugyadav-28/brandfit.git
cd brandfit
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL**, **anon/public key**, and **service_role secret key** under **Project Settings > API**.

### 5. Run Database Migrations in Order
In the Supabase Dashboard, open the **SQL Editor** and run the SQL migration files in [`docs/sql`](docs/sql) in the following numbered order:

1. **`docs/sql/001-normalise-codes.sql`**: Normalizes existing rule and fact codes to uppercase.
2. **`docs/sql/010-retrieval.sql`**: Enables the `vector` extension (`pgvector`), adds `embedding` (768 dimensions) and `embedded_at` columns with HNSW cosine indexes to `rules` and `facts`, and creates the `match_rules` and `match_facts` vector search functions.
3. **`docs/sql/020-escalation.sql`**: Updates submission status constraints to support `escalated`, adds `needs_escalation` to rules, and creates the `escalations` table.
4. **`docs/sql/030-rls-policies.sql`**: Enables Row Level Security and defines access policies for all core tables.
5. **`docs/sql/040-uploads.sql`**: Adds media fields (`source_type`, `source_filename`, `image_path`, `image_alt`, `check_notes`) to `submissions`, adds media finding sources, creates the `brand_colours` table, and registers the private `uploads` storage bucket.

### 6. Configure Environment Variables
Create a `.env.local` file in the root directory based on `.env.example`:

```env
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_SECRET_KEY=your-supabase-service-role-secret-key

# Google Gemini API configuration
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_VISION_MODEL=gemini-2.5-flash
```

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (used by client and server). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key used in browser client sessions. |
| `SUPABASE_SECRET_KEY` | Supabase service role secret key used exclusively on the server by `createAdminClient()`. |
| `GEMINI_API_KEY` | Google Gemini API key used for content review, visual inspection, and embeddings. |
| `GEMINI_MODEL` | *(Optional, default: `gemini-2.5-flash`)* Model for text compliance checks and rule rewrites. |
| `GEMINI_EMBEDDING_MODEL` | *(Optional, default: `gemini-embedding-001`)* Model for 768-dim semantic search embeddings. |
| `GEMINI_VISION_MODEL` | *(Optional, default: `gemini-2.5-flash`)* Model for image perception and alt text analysis. |

### 7. Storage Bucket Note
The migration script `docs/sql/040-uploads.sql` automatically registers the `uploads` bucket in the `storage.buckets` table with `public: false`. Verify in your Supabase dashboard under **Storage** that the **`uploads`** bucket exists and is set to **Private** so uploaded images remain protected.

### 8. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## NPM Scripts

The following scripts are defined in [`package.json`](package.json):

| Script | Command | Purpose | Needs DB? | Needs AI? |
| :--- | :--- | :--- | :---: | :---: |
| `dev` | `npm run dev` | Starts the Next.js local development server on port 3000. | Yes | Yes (on review) |
| `build` | `npm run build` | Compiles an optimized production build and validates TypeScript types. | No | No |
| `start` | `npm start` | Starts the production server after running `npm run build`. | Yes | Yes (on review) |
| `lint` | `npm run lint` | Runs ESLint to verify code quality and style conventions. | No | No |
| `test` | `npm test` | Runs the test runner across 5 offline test suites (insights, media, color, team activity, suggestions). | No | No |
| `test:rls` | `npm run test:rls` | Validates PostgreSQL Row Level Security multi-tenant boundaries across roles. | Yes | No |
| `test:media` | `npm run test:media` | Tests file signature magic bytes validation and document text extraction. | No | No |
| `test:color` | `npm run test:color` | Tests WCAG 2.1 contrast formulas, CIE76 deltaE, and nearest color palette matching. | No | No |
| `test:insights` | `npm run test:insights` | Tests insights aggregation math (broken rules, repeat mistakes, rejection rates, trends). | No | No |
| `eval` | `npm run eval` | Benchmarks review engine precision, recall, and citation accuracy on golden test posts. | Yes | Yes |
| `backfill` | `npm run backfill` | Generates and persists vector embeddings for all existing brand rules and facts missing them. | Yes | Yes |
| `backfill:embeddings` | `npm run backfill:embeddings` | Alias for `npm run backfill`. | Yes | Yes |

---

## Folder Map

```
brandfit/
├── app/                                 # Next.js App Router
│   ├── actions/                         # Shared Server Actions (company, guidelines, members)
│   ├── api/                             # REST Route Handlers
│   │   ├── escalations/[id]/resolve/    # Resolve escalations (Authorised Reviewer / Employer)
│   │   ├── findings/[id]/               # PATCH finding decisions (accept, edit, reject)
│   │   ├── submissions/                 # Submission lifecycle routes
│   │   │   ├── [id]/comments/           # Threaded review comments
│   │   │   ├── [id]/decision/           # Review decisions (approved, changes_requested)
│   │   │   ├── [id]/escalate/           # Escalate submission for sensitive rule sign-off
│   │   │   ├── [id]/review/             # Trigger automated review run
│   │   │   ├── [id]/send/               # Transition draft to in_review
│   │   │   └── [id]/versions/           # Create subsequent content versions
│   │   └── uploads/                     # Media upload endpoints
│   │       ├── document/                # PDF & DOCX upload and extraction
│   │       ├── image/                   # Image upload, color analysis, and visual check
│   │       └── image-url/               # Image URL review endpoint
│   ├── auth/                            # Supabase Auth routes (login, sign-up, confirm)
│   ├── company/                         # Employer workspace administration
│   │   ├── audit/                       # Immutable audit log explorer
│   │   ├── guidelines/                  # Rules, Facts, Terms, and Brand Colours management
│   │   ├── members/                     # Member roles and join code management
│   │   ├── new/                         # Company workspace creation form
│   │   └── settings/                    # Company name settings
│   ├── dashboard/                       # Overview dashboard & team activity
│   │   ├── insights/                    # Analytics charts & AI rule clarity rewrites
│   │   ├── loading.tsx                  # Dashboard loading skeleton
│   │   └── page.tsx                     # Main dashboard page
│   ├── disclosure/                      # Public AI transparency and model disclosure policy
│   ├── join/                            # 6-character company join code entry
│   ├── my/                              # Employee submissions list & status tracking
│   │   └── loading.tsx                  # My posts loading skeleton
│   ├── review/                          # Reviewer queue & inspector
│   │   ├── [id]/                        # Submission reviewer inspector
│   │   ├── loading.tsx                  # Review queue loading skeleton
│   │   └── page.tsx                     # Filterable review queue
│   ├── submit/                          # Content creation & automated review triage
│   │   ├── [id]/                        # Version review & triage interface
│   │   └── page.tsx                     # New submission form with UploadPanel
│   ├── error.tsx                        # Global error boundary with Go Back button
│   ├── not-found.tsx                    # Friendly 404 page with Go Back button
│   ├── layout.tsx                       # Root layout with Nav and ThemeProvider
│   └── page.tsx                         # Public landing page with 3-minute demo guide
├── components/                          # React UI Components
│   ├── ui/                              # Radix UI + Tailwind primitives (Button, Input, Card, etc.)
│   ├── ai-badge.tsx                     # AI suggestion badge and accessible help tooltips
│   ├── get-started-card.tsx             # Onboarding setup checklist for employers
│   ├── nav.tsx                          # Navigation bar with role badges and count indicators
│   ├── nav-client.tsx                   # Responsive mobile navigation menu
│   └── upload-panel.tsx                 # Multi-format tabbed upload panel (Text, Document, Image)
├── docs/                                # Project Documentation & Specifications
│   ├── sql/                             # Numbered SQL migration files (001 to 040)
│   ├── ARCHITECTURE.md                  # Comprehensive architecture specification
│   ├── CONTRACT.md                      # Roles, endpoints, and developer ownership boundaries
│   ├── PRIVACY_SECURITY.md              # Security model and data handling disclosure
│   └── TESTING.md                       # Test suites, RLS verification, and evaluation guide
├── lib/                                 # Shared Library & Core Business Logic
│   ├── insights/                        # Insights computation math & nav count queries
│   ├── media/                           # File validation, document extraction, sharp color engine
│   ├── retrieval/                       # Semantic embedding generation and pgvector search
│   ├── review/                          # Rule checks, Gemini AI review, rate limiting, pipeline
│   ├── supabase/                        # Browser, server, and admin Supabase clients
│   ├── audit.ts                         # Server audit logging helper
│   ├── auth.ts                          # Session validation and role guards
│   ├── demo.ts                          # Demo account credentials
│   └── types.ts                         # Shared TypeScript interfaces and enums
├── scripts/                             # Test suites, evaluation harness, and seeds
│   ├── backfill-embeddings.ts           # Batch embedding generation script
│   ├── eval.ts                          # Precision/recall evaluation benchmark runner
│   ├── run-tests.js                     # Unified test suite runner
│   ├── test-color.ts                    # Color engine unit tests
│   ├── test-insights.ts                 # Analytics computation tests
│   ├── test-media.ts                    # Media signature and document checks tests
│   ├── test-rls.ts                      # PostgreSQL Row Level Security test suite
│   ├── test-safe-suggestion.ts          # Safe suggestion sanitization tests
│   └── test-team-activity.ts            # Team activity calculation tests
└── seed/                                # Sample brand kit JSON fixtures (FreshBrew Coffee)
```

---

## Architecture Summary

BrandFit is structured as a unified Next.js App Router application connecting a browser client to a PostgreSQL database (hosted on Supabase) and Google Gemini AI via the `@google/genai` SDK.

The core pipeline processes submissions through deterministic local checks, semantic `pgvector` retrieval, and schema-constrained Gemini API evaluations:
- **Client Tier**: Server-rendered React Server Components with client hydration for interactive triage interfaces.
- **Server Guard Tier**: Authentication (`requireUser()`), company role verification (`requireMember()`), and sliding-window rate limiting (`checkReviewRateLimit()`).
- **Processing Tier**: File header validation (`lib/media/validate.ts`), text extraction (`unpdf`, `mammoth`), dominant color extraction (`sharp`), and WCAG contrast scoring.
- **Database Tier**: Multi-tenant PostgreSQL database with Row Level Security on every table. All database queries execute server-side through `createAdminClient()`.
- **Vector Tier**: 768-dimensional vector embeddings stored in PostgreSQL using `pgvector` with HNSW indexing for sub-linear semantic retrieval.

For an in-depth breakdown of pipeline flows, state machine diagrams, database schemas, and technical decisions, read [ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Testing

BrandFit includes a multi-tiered automated testing suite covering unit math, file signature validation, accessibility extraction, database Row Level Security isolation, and AI review precision/recall benchmarking:

- **Unit & Regression Suite (`npm test`)**: Executes 5 test suites in under a second with zero external dependencies.
- **Row Level Security Suite (`npm run test:rls`)**: Validates tenant isolation across roles against a live Supabase database.
- **Evaluation Harness (`npm run eval`)**: Benchmarks detection accuracy, false positive rates, and citation validity against golden test posts.

For detailed testing guidelines, assertions, and command options, read [TESTING.md](docs/TESTING.md).

---

## Known Limitations

- **AI Model Advisories**: The Google Gemini model can occasionally generate false positives or overlook subtle context. All AI findings are advisory suggestions; content changes are never applied without human review.
- **Provider Free-Tier Terms**: On Google Gemini API free tiers, requests may be used by the provider to train and improve models. Only non-confidential or fictional material should be uploaded on the free tier.
- **Review Rate Limits**: Content reviews are capped at 10 scans per user per 10-minute sliding window to protect API quotas.
- **Document Text Truncation**: Documents (PDF and DOCX) are inspected up to the first 10,000 characters. Content exceeding 10,000 characters is truncated, with an informative note recorded on the submission.
- **Active Workspace Resolution**: User sessions resolve to their primary membership role. Users belonging to multiple companies default to their employer or reviewer workspace.
