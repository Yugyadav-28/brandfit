# BrandFit Privacy and Security

This document details the data privacy boundaries, security controls, access models, external API interactions, and enterprise readiness requirements implemented across BrandFit.

---

## 1. What Data is Stored and Where

BrandFit stores data across two discrete infrastructure tiers in Supabase: an encrypted PostgreSQL relational database and a private object storage bucket.

### A. Relational Database (Supabase PostgreSQL)
All structural, relational, and textual data resides in PostgreSQL with multi-tenant partitioning by `company_id`. Extracted document text, draft versions, brand rules, and vector embeddings are stored directly in database tables:

| Table | Stored Data & Purpose | Storage Detail |
| :--- | :--- | :--- |
| `companies` | Workspace identity, workspace owner (`owner_id`), and 6-character uppercase `join_code`. | Metadata |
| `memberships` | User workspace association (`user_id`, `company_id`), role (`employer`, `reviewer`, `authorised_reviewer`, `employee`), and display name. | Access control |
| `rules` | Brand guidelines (code, category, title, body, `is_sensitive` flag) and 768-dimensional vector embedding (`embedding vector(768)`). | Guidelines & Vectors |
| `facts` | Approved organizational facts (fact code, factual statement) and 768-dimensional vector embedding (`embedding vector(768)`). | Knowledge base & Vectors |
| `terms` | Terminology preferences (avoided term, preferred alternative, explanation). | Terminology dictionary |
| `brand_colours` | Approved brand color palette (color name, verified 6-digit hex code). | Color palette |
| `submissions` | Content submissions (`company_id`, `author_id`, `title`, `status`, `source_type` ['text', 'document', 'image'], `source_filename`, `image_path`, `image_alt`, `check_notes`). | Submission metadata |
| `versions` | Content revision history (`submission_id`, `version_no`, `content`). **Extracted document text is stored here** as plain text. | Content versions |
| `findings` | Automated and AI compliance findings (`version_id`, `category`, `severity`, `quoted_text`, `explanation`, `rule_code`, `suggestion`, `confidence`, `source`, `decision`, `rejection_reason`). | Compliance feedback |
| `comments` | Collaboration threads between authors and reviewers (`submission_id`, `author_id`, `content`). | Discussion |
| `approvals` | Formal approval decisions (`submission_id`, `reviewer_id`, `notes`, `status`). | Sign-off records |
| `escalations` | Escalation tracking for sensitive rules or manual referral (`submission_id`, `reason`, `status`, `resolved_by`, `resolution_notes`). | Compliance escalation |
| `audit_log` | Immutable record of all workspace events (`company_id`, `user_id`, `action`, `detail`, `created_at`). | Compliance audit |

### B. Private Storage (Supabase Storage Bucket `uploads`)
- **Uploaded Images**: All uploaded image binaries (PNG, JPEG, WebP) are uploaded to the private Supabase Storage bucket named `uploads` (`public: false`).
- **Storage Paths**: Files are partitioned using isolated directory structures: `${companyId}/${submissionId}/${safeFileName}`.
- **Access Restrictions**: The bucket is not public. Images cannot be accessed via direct public URLs. Image access is mediated strictly through server-generated, time-limited signed URLs (1-hour expiration) generated via `createSignedUrl` after confirming the requesting user's company membership and role permissions (`/api/uploads/image-url`).
- **Extracted Text Separation**: Uploaded document files (PDF and DOCX) are processed in-memory via `unpdf` and `mammoth`. The extracted text is persisted to the database in `versions.content`, while binary document files are not retained in object storage.

---

## 2. What is Sent to Google Gemini

When an automated check, visual scan, embedding generation, or rule rewrite is executed, BrandFit transmits only the strictly relevant data to the Google Gemini API:

1. **Review Text**:
   - The user-authored draft content or text extracted from an uploaded document.
   - Transmitted to Gemini wrapped inside distinct `<content>...</content>` data tags with explicit system instructions instructing the model to treat the content strictly as data, never as instructions.
2. **Rule and Fact Text for Embeddings**:
   - Rule titles, rule bodies, rule codes, categories, and approved fact statements.
   - Sent to the Gemini Embedding API (`gemini-embedding-001` or `GEMINI_EMBEDDING_MODEL`) to produce 768-dimensional semantic vectors for similarity search via `pgvector`.
3. **Images**:
   - Uploaded image binaries are sent as base64-encoded image parts (`{ type: 'image', data: base64, mime_type: mime }`) to Gemini Vision (`gemini-2.5-flash` or `GEMINI_VISION_MODEL`).
   - Analyzed for visual brand compliance, alt text description accuracy, and text-on-image OCR regions.
4. **Document Text**:
   - Plain text extracted from PDF and Word documents (first 10,000 characters) is sent to Gemini for rule compliance, factual verification, and tone analysis.
5. **Rule Rewrite Requests**:
   - When an employer requests clearer wording for an unclear brand rule (`/dashboard/insights`), BrandFit transmits the current rule code, category, title, body, together with anonymized writer rejection reasons and quoted content snippets.

---

## 3. What is NEVER Sent to Google Gemini

BrandFit strictly isolates sensitive identity and credential data from external AI providers:

- **Passwords and Credentials**: User passwords, session tokens, and database credentials are treated exclusively within Supabase Auth and server-side configurations. They are never included in prompts.
- **Personal Identities and Emails**: User email addresses, full names, display names, and user UUIDs are never included in AI review or vision payloads.
- **Other Companies' Data**: All retrieval queries and guideline lookups are filtered strictly by `company_id`. A company's submitted drafts, rules, facts, or brand colors are never co-mingled with or exposed to prompts for another company.
- **Internal Database IDs and File Paths**: Database primary keys, storage bucket credentials, and private bucket paths are excluded from AI prompts.
- **Audit Logs and Comments**: Historical workspace audit logs and reviewer discussion threads are never sent to Gemini.

---

## 4. Free Tier Privacy Warning

> [!WARNING]
> **"Only upload made-up or non-confidential material on this free tier."**

Under Google's standard terms of service for free-tier Gemini API usage, prompt inputs, uploaded documents, images, and model responses may be logged, reviewed by human evaluators, and used by Google to train and improve its machine learning models.

**BrandFit displays this warning prominently across the application:**
- At the top of the `/disclosure` page.
- In the file upload dialogs for documents and images.
- Within workspace documentation and onboarding guides.

Users are instructed never to submit real company trade secrets, confidential customer data, personally identifiable information (PII), or proprietary documents while operating on the free tier.

---

## 5. Who Can See What by Role

BrandFit enforces strict Role-Based Access Control (RBAC) across four defined roles, backed by server guards and PostgreSQL Row Level Security:

| Role | Guidelines & Settings | Submissions & Drafts | Review Queue | Escalations | Audit Log |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Employer** | Full manage access: create, edit, delete rules, facts, terms, palette, member roles, invite join code. | View all submissions across the company. | Inspect, comment, approve, or request changes on all submissions. | Full access to review and resolve escalations. | Read access to `/company/audit`. |
| **Reviewer** | Read-only access to brand guidelines and palette. | View submissions in `in_review` or `changes_requested`. | Inspect, comment, approve, request changes, or escalate sensitive issues. | Can escalate to authorised reviewers; cannot resolve. | No access. |
| **Authorised Reviewer** | Read-only access to brand guidelines and palette. | View submissions in `in_review`, `changes_requested`, or `escalated`. | Inspect, comment, approve, request changes, or escalate. | **Can review and resolve escalated submissions** (including sensitive rules). | No access. |
| **Employee** | Read-only access to brand guidelines. | **Only view and edit their own submissions** in "My Posts" (`/my`). | No access to the review queue. | No access. | No access. |
| **Non-Members** | No access. | No access. | No access. | No access. | No access. |

### Workspace Creator Protection
The user who created the company workspace is registered as `owner_id` on the `companies` table. BrandFit prevents other employers from demoting or removing the workspace owner (`lib/actions/members.ts`).

---

## 6. How Row Level Security (RLS) Policies and Server Checks Work

BrandFit employs a defense-in-depth model combining application-layer server guards with database-layer PostgreSQL Row Level Security:

```
User Request (Browser)
   │
   ▼
[1] Next.js Server Route / Server Action
   ├── requireUser()         ──> Validates Supabase Auth JWT
   └── requireMember(coId)   ──> Validates company membership & role
   │
   ▼
[2] Service Client Execution (createAdminClient)
   └── Explicit Query Filter ──> .eq('company_id', companyId)
   │
   ▼
[3] PostgreSQL Row Level Security (RLS) Defense-in-Depth Backstop
   ├── Security Definer Functions (is_company_member, company_role)
   └── Table RLS Policies (12 tables locked to authenticated members)
```

### Application-Layer Server Guards
1. **`requireUser()`** (`lib/auth.ts`): Extracts and validates the authenticated Supabase user session from HTTP cookies via `@supabase/ssr`. Throws an error or redirects if unauthenticated.
2. **`requireMember(companyId, allowedRoles?)`** (`lib/auth.ts`): Queries the `memberships` table using the authenticated user ID and target `company_id`. Confirms the user is an active member and verifies their role against `allowedRoles`.
3. **Explicit Multi-Tenant Scoping**: All database operations specify `.eq('company_id', companyId)`. Cross-company joins or unpartitioned queries are prohibited.

### Database-Layer Row Level Security (RLS)
RLS is enabled across all database tables (`companies`, `memberships`, `rules`, `facts`, `terms`, `brand_colours`, `submissions`, `versions`, `findings`, `comments`, `approvals`, `escalations`, `audit_log`). Direct public/anon access from the browser is completely revoked.

RLS policies utilize PostgreSQL security definer helper functions (`docs/sql/030-rls-policies.sql`):
- `public.is_company_member(uuid)`: Validates that `auth.uid()` has a membership record matching the company ID.
- `public.company_role(uuid)`: Returns the caller's role (`employer`, `reviewer`, `authorised_reviewer`, `employee`) for that workspace.
- `public.can_see_submission(uuid)`: Verifies the caller is either the author or holds `employer`, `reviewer`, or `authorised_reviewer` status in that company.
- `public.is_submission_author(uuid)`: Verifies that `auth.uid()` matches `submissions.author_id`.
- `public.can_see_version(uuid)` and `public.is_version_author(uuid)`: Cascades submission access checks to child revision records.

**Even if an attacker bypassed the Next.js application server, direct queries via Supabase client credentials cannot read or alter rows belonging to another user or tenant.**

---

## 7. How Keys are Handled

BrandFit enforces strict boundaries between server secrets and client-accessible environment variables:

- **Server-Only Secrets**:
  - `SUPABASE_SECRET_KEY`: Supabase service role key granting elevated database privileges. Never prefixed with `NEXT_PUBLIC_`.
  - `GEMINI_API_KEY`: API key for Google Gemini interactions. Never prefixed with `NEXT_PUBLIC_`.
  - Next.js excludes non-prefixed environment variables from browser bundles during the build process.
- **Client-Exposed Configuration**:
  - Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are sent to the browser. The publishable key has zero bypass capabilities and is completely bound by Row Level Security.
- **Server Client Instantiation**:
  - The privileged database client (`createAdminClient()`) is initialized exclusively inside `lib/supabase/admin.ts` on the server and is never imported into Client Components.
- **In-Memory Key Redaction**:
  - The AI review subsystem incorporates `sanitizeMessage` (`lib/review/aiReview.ts`) to scrub any accidental inclusion of `GEMINI_API_KEY` from logs, stack traces, and API error returns, replacing matches with `[REDACTED]`.
- **Zero Logging Policy**:
  - Extracted document text, uploaded file buffers, and API credentials are never written to server console logs or audit details.

---

## 8. Immutable Audit Logging

Every critical business action is recorded in the append-only `audit_log` table via `logAudit()` (`lib/audit.ts`):

- **Append-Only Integrity**: The `audit_log` table only permits `INSERT` statements. There are no `UPDATE` or `DELETE` RLS policies or application endpoints, preventing retroactive modification or log tampering.
- **Tracked Operations**:
  - Workspaces: `company_created`
  - Membership: `member_joined`, `role_changed`, `member_removed`
  - Guidelines: `rule_saved`, `rule_deleted`, `fact_saved`, `term_saved`, `rule_rewrite_applied`
  - Submissions: `submission_created`, `review_run`, `upload_reviewed`, `finding_decided`, `sent_for_review`
  - Review & Governance: `approved`, `changes_requested`, `escalated`, `escalation_resolved`, `comment_added`
- **Logged Metadata**:
  - `company_id`: Workspace identifier.
  - `user_id`: Authenticated user who performed the action.
  - `action`: Exact event string.
  - `detail`: Structured JSON object capturing non-sensitive entity identifiers, previous/new roles, rule codes, or decision reasons.
  - `created_at`: Server-generated timestamp (`timestamptz default now()`).
- **Audit Access**: RLS restricts audit log queries exclusively to employers (`public.company_role(company_id) = 'employer'`). Reviewers and employees cannot view audit records.

---

## 9. Human Oversight and Governance

BrandFit adheres to strict human-in-the-loop design principles to prevent automated errors from impacting published material:

1. **Advisory AI Only**:
   - Google Gemini functions strictly as an advisory evaluation engine. It possesses no agency, tools, or administrative endpoints to edit drafts, publish posts, or approve submissions automatically.
2. **Creator Control (Triage)**:
   - When AI findings are generated, the content creator inspects each finding individually.
   - The creator maintains sole authority to **Accept** the suggestion (incorporating the rewrite), **Edit** the text directly, or **Reject** the finding with an explanatory rationale note.
3. **Reviewer Gatekeeping**:
   - Submissions cannot transition to `approved` status through automated means.
   - A qualified human reviewer, authorised reviewer, or employer must examine the submission, inspect resolved findings, and explicitly record an approval decision.
4. **Sensitive Rule Escalation**:
   - Brand rules flagged as sensitive (`is_sensitive = true`, such as financial figures, clinical claims, or legal statements) trigger mandatory escalation.
   - Standard reviewers cannot approve escalated posts; they must be evaluated and signed off by an `authorised_reviewer` or `employer`.
5. **Transparent Source Attribution**:
   - Every finding explicitly identifies its origin (`source` = `'rule_check'`, `'ai'`, `'image_check'`, or `'doc_check'`).
   - Automated AI suggestions are visually badged with the `<AiBadge />` component, ensuring human operators immediately distinguish between deterministic rule violations and generative model suggestions.

---

## 10. What a Real Company Would Need Before Using with Confidential Material

Before deploying BrandFit in an enterprise environment handling confidential, proprietary, or regulated material, the following security and compliance controls must be implemented:

1. **Enterprise Google Cloud Agreement / Vertex AI**:
   - Transition from the consumer Gemini API to **Google Cloud Vertex AI** with an enterprise Business Associate Agreement (BAA) and Zero Data Retention (ZDR) guarantee.
   - Ensure customer prompts, uploaded images, and extracted text are covered by Google Cloud's commitments that customer data is never cached, logged for inspection, or used to train foundation models.
2. **Dedicated Single-Tenant Database & CMEK**:
   - Migrate to a dedicated, single-tenant Supabase or AWS RDS PostgreSQL instance with Customer-Managed Encryption Keys (CMEK) via AWS KMS or GCP Cloud KMS for data at rest.
   - Implement column-level encryption for sensitive draft content (`versions.content`) and factual disclosures.
3. **Enterprise Identity & Access Management (SSO / SCIM)**:
   - Integrate Single Sign-On via SAML 2.0 / OIDC with corporate Identity Providers (Okta, Microsoft Entra ID, Google Workspace).
   - Implement automated user provisioning, role synchronization, and instantaneous de-provisioning via SCIM.
4. **Automated DLP and PII Scrubbing**:
   - Deploy an in-line Data Loss Prevention (DLP) sanitization pipeline to detect and redact Personally Identifiable Information (PII), Payment Card Industry (PCI) numbers, and Protected Health Information (PHI) before content is transmitted to AI model endpoints.
5. **Data Retention and Right-to-Erasure Lifecycles**:
   - Implement configurable data retention policies that automatically purge or archive submissions, draft versions, and audit logs after designated compliance periods (e.g., 90 days, 1 year).
   - Provide automated GDPR / CCPA right-to-erasure workflows to purge user submissions and audit traces upon request.
6. **Formal Compliance Certifications and DPAs**:
   - Execute bilateral Data Processing Agreements (DPAs) incorporating standard contractual clauses (SCCs) across all infrastructure vendors (Google Cloud, Supabase, Vercel).
   - Complete formal third-party SOC 2 Type II and ISO/IEC 27001 compliance audits covering BrandFit's operational infrastructure.
