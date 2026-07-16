
-- Enable pgvector for embeddings
create extension if not exists vector;

-- Documents table
create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_type text not null,
  file_url text not null,
  processing_status text not null default 'uploaded' check (processing_status in ('uploaded','processing','ready','failed')),
  total_chunks integer not null default 0,
  error_message text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.knowledge_documents to authenticated;
grant all on public.knowledge_documents to service_role;

alter table public.knowledge_documents enable row level security;

create policy "Users view own knowledge documents"
  on public.knowledge_documents for select
  to authenticated using (auth.uid() = created_by);

create policy "Users insert own knowledge documents"
  on public.knowledge_documents for insert
  to authenticated with check (auth.uid() = created_by);

create policy "Users update own knowledge documents"
  on public.knowledge_documents for update
  to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

create policy "Users delete own knowledge documents"
  on public.knowledge_documents for delete
  to authenticated using (auth.uid() = created_by);

create trigger knowledge_documents_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

-- Chunks table (768-dim for Google text-embedding-004)
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_text text not null,
  chunk_index integer not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.knowledge_chunks to authenticated;
grant all on public.knowledge_chunks to service_role;

alter table public.knowledge_chunks enable row level security;

create policy "Users view own knowledge chunks"
  on public.knowledge_chunks for select
  to authenticated using (
    exists (select 1 from public.knowledge_documents d where d.id = document_id and d.created_by = auth.uid())
  );

create policy "Users insert own knowledge chunks"
  on public.knowledge_chunks for insert
  to authenticated with check (
    exists (select 1 from public.knowledge_documents d where d.id = document_id and d.created_by = auth.uid())
  );

create policy "Users delete own knowledge chunks"
  on public.knowledge_chunks for delete
  to authenticated using (
    exists (select 1 from public.knowledge_documents d where d.id = document_id and d.created_by = auth.uid())
  );

create index knowledge_chunks_document_id_idx on public.knowledge_chunks(document_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- Storage policies for knowledge-base bucket: users can only access files in a folder matching their uid
create policy "Users view own knowledge files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'knowledge-base' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload own knowledge files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'knowledge-base' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own knowledge files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'knowledge-base' and auth.uid()::text = (storage.foldername(name))[1]);
