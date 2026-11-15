begin;
alter table submissions add column if not exists source_type text not null
default 'text'
check (source_type in ('text','document','image'));
alter table submissions add column if not exists source_filename text;
alter table submissions add column if not exists image_path text;
alter table submissions add column if not exists image_alt text;
alter table submissions add column if not exists check_notes text;
alter table findings drop constraint if exists findings_source_check;
alter table findings add constraint findings_source_check
check (source in ('rule_check','ai','image_check','doc_check'));
create table if not exists brand_colours (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references companies(id) on delete cascade,
name text not null,
hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
created_at timestamptz default now()
);
alter table brand_colours enable row level security;
create policy brand_colours_select on brand_colours for select to
authenticated using (public.is_company_member(company_id));
create policy brand_colours_write on brand_colours for all to authenticated
using (public.company_role(company_id) = 'employer') with check
(public.company_role(company_id) = 'employer');
insert into storage.buckets (id, name, public) values ('uploads', 'uploads',
false) on conflict (id) do nothing;
commit;
