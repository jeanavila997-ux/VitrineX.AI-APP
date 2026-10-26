# Integrar Supabase no VitrineX AI

Guia oficial deste repo. Docs do produto: [supabase.com/docs](https://supabase.com/docs) · Auth e-mail/senha: [Password-based Auth](https://supabase.com/docs/guides/auth/passwords) · RLS: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Visão rápida

| Peça | Onde |
|---|---|
| Chaves no app | `.env` → `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| Schema + RLS + Storage | `supabase/migrations/20261026_vitrinex_init.sql` |
| Cliente JS | `src/lib/supabase.ts` |
| Login / cadastro | `src/contexts/AuthContext.tsx` + `AuthPage` |

Sem as duas variáveis, o app fica em **modo demo** (qualquer e-mail/senha).

---

## 1. Criar o projeto (dashboard)

1. Abra [https://supabase.com/dashboard](https://supabase.com/dashboard) e faça login.
2. **New project** → nome `vitrinex` (ou o que preferir) → senha forte do DB → região próxima (ex. South America).
3. Espere o projeto ficar **Healthy**.

## 2. Copiar as chaves

1. **Project Settings** → **API**.
2. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`  
     (nunca coloque a `service_role` no frontend)

No arquivo `.env` na raiz do app (`C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP\.env`):

```env
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...sua_anon_key
VITE_AUTH_REDIRECT_URI=http://127.0.0.1:8080
```

Reinicie o Vite (`Ctrl+C` e `npm run dev`) — o Vite só lê `.env` na subida.

## 3. Rodar o SQL (tabelas + RLS + bucket)

1. No dashboard: **SQL Editor** → **New query**.
2. Abra no VS Code / editor o arquivo:

   `supabase/migrations/20261026_vitrinex_init.sql`

3. Cole **tudo** no editor do Supabase → **Run**.
4. Confirme no **Table Editor** as tabelas: `users`, `posts`, `ads`, `campaigns`, `trends`, `library_items`, `schedule`, `target_audiences`.
5. Em **Storage**, deve existir o bucket `media`.

O script é **idempotente** (pode rodar de novo).

## 4. Auth: e-mail e URLs

1. **Authentication** → **Providers** → **Email** → ligado.
2. Para testes locais, desmarque **Confirm email** (senão o cadastro pede clique no e-mail antes do login).  
   Docs: [Password-based Auth](https://supabase.com/docs/guides/auth/passwords).
3. **Authentication** → **URL Configuration**:
   - **Site URL**: `http://127.0.0.1:8080`
   - **Redirect URLs**: adicione `http://127.0.0.1:8080` e, se usar Vercel, a URL de produção.

## 5. Testar no app

```powershell
cd C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP
npm run dev
```

1. Abra `http://127.0.0.1:8080` — o banner amarelo **não** deve aparecer.
2. **Cadastre-se** com um e-mail real (ou o que o provedor permitir).
3. Faça login → em **Configurações** salve o perfil.
4. Gere um post / salve na biblioteca: os dados devem aparecer no Table Editor do Supabase.

No console do browser deve sair: `✅ Supabase configurado: https://...`

## 6. Checklist se algo falhar

| Sintoma | Causa comum |
|---|---|
| Banner amarelo “Sem Supabase” | `.env` vazio / Vite não reiniciado / chave placeholder |
| `Invalid API key` | Colou `service_role` ou truncou a anon key |
| Cadastro ok, login “Email not confirmed” | Confirm email ligado — confirme o e-mail ou desative em Providers |
| `relation "public.users" does not exist` | SQL da migration não rodou |
| Select vazio / 401 nas tabelas | RLS ok, mas sem sessão — faça login de novo |
| Upload de mídia falha | Bucket `media` ou policies de Storage |

## Segurança (lembrete)

- A **anon key** é pública no bundle Vite — isso é esperado.
- A proteção real é a **RLS** (`auth.uid() = "userId"`). Não desligue RLS em produção.
- Nunca commite `.env` com chaves reais (já deve estar no `.gitignore`).

## Próximos passos opcionais

- Gerar tipos oficiais: `npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`
- Edge Function `stripe-manager` (já referida em `SubscriptionSection`)
- SMTP próprio para e-mails de confirmação em produção
