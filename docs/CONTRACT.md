# BrandFit contract
## Roles
employer (creates the company, sets rules, final say), reviewer (approves
content), employee (submits content). An employer can also review.
## Submission status flow
draft -> in
_
review -> approved
-> changes
_
requested -> creator edits (new version) ->
in
_
review
## Finding (one AI or rule-check result)
{ category: 'tone' | 'terminology' | 'claims' | 'facts' | 'visual' |
'accessibility'
,
severity: 'low' | 'medium' | 'high'
,
quoted
_
text: string, // exact words from the content
explanation: string, // why it was flagged, one or two plain sentences
rule
_
code: string, // a rule code like C-1 or a fact code like F-2;
'TERM' for terminology list matches
suggestion: string, // a rewrite that keeps the writer's meaning
confidence: number, // 0 to 1
source: 'rule
_
check' | 'ai' }
## Shared helpers
- createAdminClient() in lib/supabase/admin.ts
- requireUser(), requireMember(companyId, allowedRoles?), getMyMemberships()
in lib/auth.ts
- logAudit({ companyId, userId, action, detail }) in lib/audit.ts
- runReview(companyId, text) in lib/review/runReview.ts returns { findings:
Finding[], aiStatus: 'ok' | 'unavailable' }
## Audit action names
company_
created, member
_joined, role
_
changed, member
_
removed, rule
_
saved,
rule
_
deleted, fact
_
saved, term
_
saved, submission
_
created, review
_
run,
finding_
decided, sent
_
for
_
review, approved, changes
_
requested, comment
_
added
## Routes owned by Yug
POST /api/submissions (companyId, title, content) creates
submission + version 1
POST /api/submissions/[id]/review runs the review on the latest version
and saves findings
POST /api/submissions/[id]/versions (content) creates the next version
PATCH /api/findings/[id] (decision, note, editedText)
POST /api/submissions/[id]/send sets status to in
_
review
POST /api/submissions/[id]/decision (decision: approved | changes
_
requested,
note)
POST /api/submissions/[id]/comments (body)
## Pages
Parvinder: /, /join, /company/new, /company/members, /company/guidelines,
/dashboard, /disclosure
Yug: /submit, /submit/[id], /review, /review/[id], /my, /company/audit
## Round 3 additions
Roles: employer, reviewer, authorised
_
reviewer, employee. The employer can do
everything the others can.
Submission status: draft, in
_
review, escalated, changes
_
requested, approved.
Finding source: 'rule
_
check' | 'ai' | 'image
_
check' | 'doc
_
check'
.
Rules have a flag needs
_
escalation. A finding that cites such a rule means
the post needs authorised sign off.
Definitions used by the dashboard and insights:
- A mistake is a finding in the FIRST version of a submission (what the
writer produced before any re-check).
- A repeated mistake is a rule code that appears in the first version of two
or more different submissions by the same author.
- Rejection rate of a rule = rejected / (accepted + edited + rejected)
decided findings for that rule code.
- A rule is possibly unclear when it has at least 5 decided findings and a
rejection rate of 40 percent or more.
New audit actions: company_
renamed, escalated, escalation
_
resolved,
rule
_
rewrite
_
applied, upload
_
reviewed, embeddings
_
refreshed.
New env vars: GEMINI
_
EMBEDDING
_
MODEL, optional GEMINI
_
VISION
_
MODEL.