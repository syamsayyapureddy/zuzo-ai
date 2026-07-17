
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  min_similarity float DEFAULT 0.5
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  chunk_index int,
  chunk_text text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.title AS document_title,
    c.chunk_index,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE d.processing_status = 'ready'
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= min_similarity
  ORDER BY c.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;
