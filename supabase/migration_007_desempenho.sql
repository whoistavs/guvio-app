-- =====================================================================
-- GUVIO — DESEMPENHO (índices)
-- Só cria índices: não muda dados nem regras. Pode rodar mais de uma vez.
-- =====================================================================

-- contagem de seguidores (perfil, sugestões) e "quem eu sigo"
create index if not exists follows_following_idx on public.follows (following_id);

-- minhas curtidas e salvos (feed, "Salvos", estatísticas)
create index if not exists likes_user_idx on public.likes (user_id, created_at desc);
create index if not exists saves_user_idx on public.saves (user_id, created_at desc);

-- stories: os que eu já vi, arquivo para destaques
create index if not exists story_views_viewer_idx on public.story_views (viewer_id);
create index if not exists stories_user_idx on public.stories (user_id, created_at desc);
create index if not exists highlight_items_story_idx on public.highlight_items (story_id);

-- feed só com posts visíveis, perfil com fixados primeiro
create index if not exists posts_feed_idx on public.posts (created_at desc) where not archived;
create index if not exists posts_profile_idx on public.posts (user_id, pinned_at desc nulls last, created_at desc) where not archived;

-- denúncias, pedidos para seguir, coleções
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists follow_requests_target_idx on public.follow_requests (target_id, created_at desc);
create index if not exists collection_items_post_idx on public.collection_items (post_id);

-- busca por texto (legenda, cidade, #hashtags, @marcações, desafio) sem ler a tabela inteira
create extension if not exists pg_trgm with schema extensions;
create index if not exists posts_caption_trgm on public.posts using gin (caption extensions.gin_trgm_ops);
create index if not exists posts_city_trgm on public.posts using gin (city extensions.gin_trgm_ops);

-- atualiza as estatísticas do planejador
analyze public.posts;
analyze public.likes;
analyze public.follows;
