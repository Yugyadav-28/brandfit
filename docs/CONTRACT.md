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