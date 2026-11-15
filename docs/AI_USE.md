# AI Use Disclosure and Development Attribution

This document describes how Artificial Intelligence was utilized in the development, runtime operations, and data generation workflows of BrandFit, including external AI services, models, templates, libraries, and our engineering review standards.

---

## 1. AI Tools, Models, and External Services

BrandFit leverages AI both as a developer tool during software construction and as an integral runtime capability within the application.

### A. Developer Tools
- **Antigravity with Gemini Models**:
  - Used by the engineering team as an agentic pair programming environment throughout the development lifecycle.
  - Employed for architecture planning, TypeScript interface design, component scaffolding, automated test authoring, database migration authoring, and accessibility auditing.

### B. Runtime AI Services & Foundation Models
All runtime AI capabilities interact with the **Google Gemini API** using the official `@google/genai` TypeScript SDK:

| Capability | Configured Model | Environment Variable | Role in BrandFit |
| :--- | :--- | :--- | :--- |
| **Review Engine** | `gemini-2.5-flash` | `GEMINI_MODEL` | Analyzes submitted draft copy and extracted document text against brand rules. Identifies tone deviations, unverified claims, terminology violations, and factual discrepancies. Outputs structured JSON citations and safe rewrites. |
| **Semantic Embeddings** | `gemini-embedding-001` | `GEMINI_EMBEDDING_MODEL` | Generates 768-dimensional numerical vectors for brand rules and approved company facts. Enables fast semantic similarity retrieval (`pgvector` cosine distance) to select relevant guidelines for long drafts. |
| **Vision & Image Checks** | `gemini-2.5-flash` | `GEMINI_VISION_MODEL` / `GEMINI_MODEL` | Evaluates uploaded image binaries for brand consistency, visual tone, accessibility, alt text accuracy, and text-on-image OCR regions. |
| **Rule Clarification & Rewrites** | `gemini-2.5-flash` | `GEMINI_MODEL` | Analyzes unclear or frequently rejected brand rules on the Insights dashboard. Uses writer rejection feedback and quoted snippets to propose concrete, actionable rule rewrites. |

### C. External Infrastructure Services
- **Supabase**:
  - **Database**: Managed PostgreSQL relational database with the `pgvector` extension for storing and indexing 768-dimensional embeddings.
  - **Authentication**: Supabase Auth for user identity, secure password hashing, and cookie-based JWT session handling via `@supabase/ssr`.
  - **Storage**: Private object storage bucket (`uploads`, `public: false`) for storing uploaded image binaries, accessed exclusively via server-signed URLs.
- **Vercel**:
  - Cloud deployment platform providing edge routing, Next.js serverless compute execution, dynamic server-side rendering (SSR), and automated CI/CD builds.

---

## 2. Foundation Template

BrandFit was initialized from the official **Next.js Supabase Starter Template**:
- **Framework**: Next.js App Router with TypeScript.
- **Styling**: Tailwind CSS with Radix UI primitives.
- **Session Architecture**: Cookie-based server-side authentication using `@supabase/ssr`.

The starter was significantly customized with multi-tenant company isolation, custom PostgreSQL schema migrations in `docs/sql/`, Row Level Security policies, the Gemini review engine, document/image parsing pipelines, and an analytics insights dashboard.

---

## 3. Main Libraries and Dependencies

BrandFit relies on a focused collection of production libraries:

| Library | Version | Purpose in Application |
| :--- | :--- | :--- |
| `@google/genai` | `^3.0.0` | Official Google GenAI SDK used for all Gemini API text review, embedding generation, and vision analysis calls. |
| `@supabase/ssr` | `latest` | Server-side authentication and cookie management for Next.js App Router (Server Components, Route Handlers, Server Actions). |
| `@supabase/supabase-js` | `latest` | Supabase JavaScript client used for database queries, service role administrative execution, and storage operations. |
| `sharp` | `^0.35.5` | High-performance image processing engine. Used for shrinking images to 64x64, pixel channel bucketing, dominant color extraction, and WCAG contrast analysis. |
| `unpdf` | `^2.2.0` | Server-side PDF document parsing and text extraction without native binary dependencies. |
| `mammoth` | `^1.13.0` | Server-side Microsoft Word (.docx) document parsing and plain text extraction. |
| `zod` | `^4.6.7` | Runtime schema definition and validation for Server Action inputs, upload forms, API payloads, and Gemini JSON outputs. |
| `recharts` | `^3.10.1` | Declarative SVG charting library used for the Insights dashboard (compliance rate trends, rule violation breakdown, team activity). |
| `lucide-react` | `^0.511.0` | Accessible, consistent iconography across all interface panels. |
| `tailwindcss` | `^3.4.1` | Utility-first styling framework implementing BrandFit's responsive, keyboard-accessible, and dark-mode compatible design system. |
| `next` | `latest` (15.x) | React application framework managing server rendering, Route Handlers, Server Actions, and bundle optimization. |
| `react` / `react-dom` | `^19.0.0` | UI component runtime and state management. |

---

## 4. Scripts that Generate Sample Data

To facilitate testing, evaluation, and demonstration without requiring real corporate data, BrandFit includes several data generation and seeding scripts:

1. **`seed/sample-brand-kit.json` (and `seed/sample-brandkit.json`)**:
   - Comprehensive reference brand kit for "Acme Corp".
   - Contains 30+ structured brand rules across 6 categories (Tone, Terminology, Claims, Facts, Visual, Accessibility), 15+ verified corporate facts, preferred/avoided terms, and official brand palette hex colors.
2. **`scripts/sample-posts.json`**:
   - Collection of realistic draft copy across diverse formats: social media announcements, promotional emails, press releases, product updates, and blog articles.
   - Includes both compliant content and deliberate violations (unverified metrics, prohibited competitor comparisons, forbidden terms, missing citations) for testing the review engine.
3. **`scripts/seed-insights-demo.ts`**:
   - Full end-to-end workspace generation script.
   - Creates a complete demonstration company ("Acme Corp"), establishes team members across all four roles (`employer`, `reviewer`, `authorised_reviewer`, `employee`), loads complete guidelines, and populates 20+ realistic submissions (text, PDF documents, and images) across multiple statuses (`draft`, `in_review`, `changes_requested`, `approved`, `escalated`).
   - Generates historical findings, author comments, reviewer decisions, and audit log events to demonstrate the Insights dashboard analytics.
4. **`scripts/load-large-kit.ts`**:
   - Stress-testing utility that seeds a workspace with over 100 rules and facts.
   - Used to benchmark vector retrieval latency, pagination behavior, and semantic search precision under heavy load.
5. **`scripts/backfill-embeddings.ts`**:
   - Batch-processing script that identifies rules and facts in the database lacking vector representations, sends them to `gemini-embedding-001`, and updates `rules.embedding` and `facts.embedding` in PostgreSQL.
6. **`scripts/eval.ts`**:
   - Automated quality evaluation script.
   - Executes the AI review pipeline against benchmark content fixtures, comparing generated findings against ground-truth annotations to measure citation validity, recall, precision, and latency.

---

## 5. Engineering Team Review and Verification Statement

> [!IMPORTANT]
> **Human Review and Ownership Statement**
>
> All AI-written and AI-assisted code, SQL migration files, API specifications, and documentation across the BrandFit project were meticulously read, inspected, tested, and edited by the human engineering team before being integrated.
>
> No AI-generated code was committed without human verification. The team implemented extensive automated test suites (`npm test`, `npm run test:rls`, `npm run test:media`, `npm run test:insights`, `npm run test:color`, `npm run eval`), validated database integrity with migration checks, verified full compilation with zero TypeScript errors (`npm run build`), and conducted manual user testing across all supported browser viewports and roles.
