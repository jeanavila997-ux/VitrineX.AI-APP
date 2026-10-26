# Supabase — instruções curtas

O guia completo está em **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**.

Resumo:

1. Crie o projeto no [dashboard](https://supabase.com/dashboard).
2. Cole `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`.
3. Rode o SQL: `supabase/migrations/20261026_vitrinex_init.sql` no SQL Editor.
4. Auth → Email ligado; para testes locais, desative “Confirm email”.
5. Site URL / Redirect: `http://127.0.0.1:8080`.
6. Reinicie `npm run dev`.
