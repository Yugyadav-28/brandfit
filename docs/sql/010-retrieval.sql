create extension if not exists vector with schema extensions;

alter table rules add column if not exists embedding extensions.vector (768);

alter table rules add column if not exists embedded_at timestamptz;

alter table facts add column if not exists embedding extensions.vector(768);

alter table facts add column if not exists embedded_at timestamptz;

create index if not exists rules_embedding_idx on rules using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists facts_embedding_idx on facts using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_rules(p_company uuid, p_embedding extensions.vector (768), p_count int) returns table (id uuid, code text, category text, title text, body text, similarity float)

language sql stable

set search_path public, extensions

as $$

select r.id, r.code, r.category, r.title, r.body. 1-(r.embedding <=> p_embedding) as similarity

from rules r

where r.company_id = p_company and r.embedding is not null

order by r.embedding <=> p_embedding

limit p_count;

$$:

create or replace function public.match_facts(p_company uuid, p_embedding extensions.vector (768), p_count int) returns table (id uuid, code text, statement text, source text, similarity float)

language sql stable

set search_path public, extensions

as $$

select f.id, f.code, f.statement, f.source,

1-(f.embedding <=> p_embedding) as similarity

from facts f

where f.company_id=p_company and f.embedding is not null

order by f.embedding <=> p_embedding

limit p_count;

$$;