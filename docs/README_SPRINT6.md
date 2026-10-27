# GUVIO — Sprint 6 Social + Globe

## O que foi implementado
- Bottom navigation Liquid Glass com bolha que acompanha o dedo e encaixa na aba ao soltar.
- Globo: continentes pretos em partículas, oceano azul-claro translúcido, rotação livre; zoom continua reservado à pinça.
- Pesquisa mundial de cidade/país integrada ao countries.dev, sem API key, cadastro ou cartão; mantém fallback local se a rede falhar.
- Feed: curtir, duplo toque para curtir, salvar, comentários e compartilhar para Direct.
- Direct com lista de conversas e mensagens locais.
- Criar post e hub do botão +.
- Guarda-roupa: estilos agora abrem uma experiência de montagem e preview.
- Busca de perfis: perfis clicáveis, seguir e abrir perfil.
- Perfil estilo rede social, configurações, salvos, atividade e bloqueados.
- Modo noturno.
- Tela de login/cadastro com e-mail, Google e Apple; funciona em modo demo sem Supabase e usa Supabase REST quando as variáveis são configuradas.

## Busca mundial de cidades e países

A pesquisa do planeta usa `countries.dev` diretamente. Não é necessário criar chave, conta ou configurar variável no `.env`.

- Cidades principais: `GET https://countries.dev/cities?q=...`
- Cidades, vilas e outros locais povoados: `GET https://countries.dev/places?q=...&class=P`
- Países: `GET https://countries.dev/name/...`
- O retorno já inclui latitude/longitude para animar o globo.
- Se a API estiver indisponível, o app mantém os destinos locais de demonstração como fallback.

## Login real
Preencha no `.env`:
`EXPO_PUBLIC_SUPABASE_URL=...`
`EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
Depois configure Google/Apple no painel do Supabase.

## Dois PCs
A forma recomendada é colocar esta pasta em um repositório Git privado. Em cada PC: `git pull`, `npm install`, `npx expo start`. Não copie `node_modules`.
Para abrir a versão web na mesma rede local: `npm run share:web`.
