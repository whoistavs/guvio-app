# Ligando o GUVIO no Supabase (backend real)

Com o Supabase configurado, o GUVIO deixa de ser demo: contas, posts, curtidas,
salvos, comentários, seguidores, stories, direct, guarda-roupa, notificações e
fotos ficam na nuvem e são compartilhados entre todos os usuários em tempo real.
Sem as chaves, o app continua funcionando em modo demo (tudo só no aparelho).

## 1. Criar o projeto

1. Entre em https://supabase.com e crie uma conta (grátis)
2. Clique em **New project**, dê o nome `guvio`, crie uma senha do banco e escolha a região **West EU (Ireland)** ou **South America (São Paulo)**
3. Espere uns 2 minutos até o projeto ficar pronto

## 2. Criar o banco de dados

1. No menu lateral, abra **SQL Editor** > **New query**
2. Cole todo o conteúdo de [`schema.sql`](./schema.sql)
3. Clique em **Run**. Deve aparecer "Success. No rows returned"

Pode rodar de novo sempre que o arquivo mudar; ele não apaga dados.

**Já tinha rodado uma versão antiga?** Rode também os arquivos `migration_*.sql` desta pasta, em ordem
(ex.: `migration_002_mutirao.sql`). Eles só adicionam o que falta.

## 3. Configurar o login

Em **Authentication** > **URL Configuration**:

- **Site URL:** `guvio://auth/callback`
- **Redirect URLs:** adicione `guvio://auth/callback` (e a URL do site na Netlify, se usar a versão web)

Em **Authentication** > **Sign In / Providers** > **Email**:

- Para testar mais rápido, desligue **Confirm email**. Com ele ligado, o app avisa a pessoa para confirmar o e-mail antes de entrar.

Google e Apple são opcionais: ative em **Sign In / Providers** e siga as instruções do próprio Supabase.

## 4. Pegar as chaves

Em **Project Settings** > **API** (ou **Data API**), copie:

- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

A chave anon é pública por natureza (vai dentro do app). A segurança vem das regras RLS do `schema.sql`. **Nunca** use a chave `service_role` no app.

## 5. Usar as chaves

- **Rodando local (Expo Go):** copie `.env.example` para `.env` e preencha as duas linhas
- **Gerando o .ipa pelo GitHub:** no repositório, vá em **Settings** > **Secrets and variables** > **Actions** > **New repository secret** e crie os dois secrets com os mesmos nomes. Depois rode **Actions** > **Gerar IPA iOS (sem assinatura)** > **Run workflow**
- **EAS Build:** `eas env:create` com os mesmos nomes

## O que fica na nuvem

| Recurso | Tabela |
|---|---|
| Perfis (@, bio, foto, cidade) | `profiles` (criado automaticamente no cadastro) |
| Posts e fotos | `posts` + bucket `media` |
| Curtidas / Salvos | `likes` / `saves` |
| Comentários | `comments` |
| Seguir | `follows` |
| Stories (24h) | `stories` |
| Direct | `messages` |
| Guarda-roupa | `wardrobe_items` (privado) |
| Bloqueios | `blocks` |
| Notificações | `notifications` (geradas por triggers) |
