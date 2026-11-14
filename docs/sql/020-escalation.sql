('draft', 'in_review', 'escalated', 'changes_requested', 'approved'));

alter table rules add column if not exists needs_escalation boolean not null default false;

create table if not exists escalations (

id uuid primary key default gen_random_uuid(),

submission_id uuid not null references submissions (id) on delete cascade,

requested_by uuid not null references auth.users(id),

reason text not null,

status text not null default 'open' check (status in

('open', 'approved', 'changes_requested')),

);

resolved_by uuid references auth.users(id),

resolution_note text,

created_at timestamptz default now(),

resolved_at timestamptz

alter table escalations enable row level security;

commit;