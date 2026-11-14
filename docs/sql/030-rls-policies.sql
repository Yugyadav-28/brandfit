begin;

do $$
declare r record;
begin
for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
end loop;
end $$;

create or replace function public.is_company_member(p_company uuid) returns boolean language sql stable security definer set search_path = public as $$
select exists (select 1 from memberships m where m.company_id = p_company and m.user_id = auth.uid());
$$;

create or replace function public.company_role(p_company uuid)
returns text language sql stable security definer set search_path = public as $$
select m.role from memberships m where m.company_id = p_company and m.user_id = auth.uid() limit 1;
$$;

create or replace function public.can_see_submission(p_submission uuid) returns boolean language sql stable security definer set search_path = public as $$
select exists (
  select 1 from submissions s
  join memberships m on m.company_id = s.company_id and m.user_id = auth.uid()
  where s.id = p_submission
  and (s.author_id = auth.uid() or m.role in ('employer', 'reviewer', 'authorised_reviewer'))
);
$$;

create or replace function public.is_submission_author(p_submission uuid) returns boolean language sql stable security definer set search_path = public as $$
select exists (select 1 from submissions s where s.id = p_submission and s.author_id = auth.uid());
$$;

create or replace function public.can_see_version(p_version uuid) returns boolean language sql stable security definer set search_path = public as $$
select exists (select 1 from versions v where v.id = p_version and public.can_see_submission(v.submission_id));
$$;

create or replace function public.is_version_author(p_version uuid) returns boolean language sql stable security definer set search_path = public as $$
select exists (select 1 from versions v where v.id = p_version and public.is_submission_author(v.submission_id));
$$;

revoke all on function public.is_company_member(uuid), public.company_role(uuid), public.can_see_submission(uuid), public.is_submission_author(uuid), public.can_see_version(uuid), public.is_version_author(uuid) from public;

grant execute on function public.is_company_member(uuid), public.company_role(uuid), public.can_see_submission(uuid), public.is_submission_author(uuid), public.can_see_version(uuid), public.is_version_author(uuid) to authenticated;

create policy companies_select on companies for select to authenticated using (public.is_company_member(id));

create policy companies_update on companies for update to authenticated using (public.company_role(id) = 'employer') with check (public.company_role(id) = 'employer');

create policy memberships_select on memberships for select to authenticated using (public.is_company_member(company_id));

create policy memberships_update on memberships for update to authenticated using (public.company_role(company_id) = 'employer') with check (public.company_role(company_id) = 'employer');

create policy memberships_delete on memberships for delete to authenticated using (public.company_role(company_id) = 'employer' and user_id != auth.uid());

create policy rules_select on rules for select to authenticated using (public.is_company_member(company_id));

create policy rules_write on rules for all to authenticated using (public.company_role(company_id) = 'employer') with check (public.company_role(company_id) = 'employer');

create policy facts_select on facts for select to authenticated using (public.is_company_member(company_id));

create policy facts_write on facts for all to authenticated using (public.company_role(company_id) = 'employer') with check (public.company_role(company_id) = 'employer');

create policy terms_select on terms for select to authenticated using (public.is_company_member(company_id));

create policy terms_write on terms for all to authenticated using (public.company_role(company_id) = 'employer') with check (public.company_role(company_id) = 'employer');

create policy submissions_select on submissions for select to authenticated using (
  public.is_company_member(company_id) and (
    author_id = auth.uid() or public.company_role(company_id) in ('employer', 'reviewer', 'authorised_reviewer')
  )
);

create policy submissions_insert on submissions for insert to authenticated with check (public.is_company_member(company_id) and author_id = auth.uid());

create policy submissions_update on submissions for update to authenticated using (
  public.is_company_member(company_id) and (
    author_id = auth.uid() or public.company_role(company_id) in ('employer', 'reviewer', 'authorised_reviewer')
  )
) with check (
  public.is_company_member(company_id) and (
    author_id = auth.uid() or public.company_role(company_id) in ('employer', 'reviewer', 'authorised_reviewer')
  )
);

create policy versions_select on versions for select to authenticated using (public.can_see_submission(submission_id));

create policy versions_insert on versions for insert to authenticated with check (public.is_submission_author(submission_id));

create policy findings_select on findings for select to authenticated using (public.can_see_version(version_id));

create policy findings_update on findings for update to authenticated using (public.is_version_author(version_id)) with check (public.is_version_author(version_id));

create policy comments_select on comments for select to authenticated using (public.can_see_submission(submission_id));

create policy comments_insert on comments for insert to authenticated with check (public.can_see_submission(submission_id) and author_id = auth.uid());

create policy approvals_select on approvals for select to authenticated using (public.can_see_submission(submission_id));

create policy escalations_select on escalations for select to authenticated using (public.can_see_submission(submission_id));

create policy audit_select on audit_log for select to authenticated using (public.company_role(company_id) = 'employer');

commit;