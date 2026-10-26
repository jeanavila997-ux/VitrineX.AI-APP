# HANDOFF — Diagnóstico VitrineX AI + vitrine-de-apps

**Data:** 2026-10-25  
**Autor do diagnóstico:** Grok Build (xAI)  
**Usuário:** Jean Carlos de Avila  
**Objetivo deste arquivo:** passar o serviço completo para outra LLM (Claude / Codex / pi / OpenCode) com contexto suficiente para continuar sem redescobrir tudo.

---

## 0. Decisão rápida: qual agente deve continuar?

| Agente | Nota | Quando usar |
|---|---|---|
| **Claude Code (Sonnet/Opus via 9Router)** | **Recomendado #1** | Recuperação completa: SSO Vercel, env, build, páginas quebradas, professor pt-BR |
| **Codex CLI** | Recomendado #2 | Depois do plano: loops curtos de `build` → corrigir → `build` |
| **OpenCode** | Só se default Nemotron estiver vivo | Config local tem modelos mortos; arriscado |
| **pi** | Não agora | Toolkit genérico; pouco ganho neste caso |
| **Grok Build** | Já fez o diagnóstico | Pode retomar se o log Vercel for colado |

**Por quê Claude Code primeiro?**  
O problema não é um bug único: são **dois projetos misturados na cabeça**, cópias OneDrive divergentes, **Deployment Protection (SSO)** na Vercel, **segredos `.env` perdidos**, e um **build script que compila Electron** antes do Vite. Isso pede leitura ampla + plano + correção multi-arquivo — ponto forte do Claude. Use Codex na fase “apertar parafusos” depois que o plano estiver claro.

**Como chamar o Claude nesta máquina (bug conhecido):**
```powershell
# O `claude` do PATH está QUEBRADO (placeholder npm).
# Use o bin real:
C:\Users\Jean\.local\bin\claude.exe
# 9Router precisa estar no ar: http://127.0.0.1:20128/v1/models
```

**Prompt de arranque sugerido (cole no Claude/Codex):**
> Leia `C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP\HANDOFF-DIAGNOSTICO-2026-10-25.md` por completo. Execute a Fase A (acesso Vercel + env) e a Fase B (build local limpo). Não misture com `vitrine-de-apps`. Responda em pt-BR, modo professor. Quando o Jean colar o log da Vercel, priorize-o sobre hipóteses.

---

## 1. São DOIS projetos diferentes (não misturar)

### A) VitrineX AI (produto de marketing com IA) — ESTE é o da URL

| Campo | Valor |
|---|---|
| URL | https://vitrine-x-ai-app.vercel.app |
| Repo GitHub (fork do Jean) | https://github.com/jeanavila997-ux/VitrineX.AI-APP |
| Upstream | https://github.com/gavtoken-design/VitrineX.AI-APP |
| Clone limpo nesta máquina | `C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP` |
| Stack | React 19 + Vite 7 + Tailwind + Supabase + Gemini + PWA + Electron opcional |
| Último commit GitHub | `11f176e` (2026-01-31) — *fix: React bundled em chunk separado…* |
| Autores recentes do git | `X-Analyser <xanalyser.fun@gmail.com>` (upstream; fork do Jean está **igual** ao upstream: `0/0` commits de diferença) |
| Deployment ID visto no HTML SSO | `dpl_5FBT14TMYFrhJ5oDsABy5BBRcCna` (região `gru1`) |

### B) vitrine-de-apps (orquestrador local dos projetos do Jean)

| Campo | Valor |
|---|---|
| Pasta | `C:\Users\Jean\Projetos\MeusApps\vitrine-de-apps` |
| Repo | https://github.com/jeanavila997-ux/vitrine-de-apps |
| Runtime | `npm start` → `http://127.0.0.1:4400` (nunca `localhost`) |
| Stack | Express + SQLite/MySQL + Node |
| Deploy | Hospedagem compartilhada / plano VPS — **não** é o `*.vercel.app` |
| Estado deploy | Domínio antigo perdido; ver `deploy/ESTADO.md` (20/10/2026) |

> Memória antiga dizia `Projetos\ProjetosPessoais\vitrine-de-apps` — **caminho obsoleto**. Caminho atual: `Projetos\MeusApps\vitrine-de-apps`.

---

## 2. Sintoma principal na URL pública

```
GET https://vitrine-x-ai-app.vercel.app/
→ 302 Location: https://vercel.com/sso-api?url=...&nonce=...
→ Página de login Vercel (GitHub / Google / ChatGPT / SAML / Passkey)
```

**Tradução:** o deploy **existe** (há `x-vercel-id`, deployment id), mas está com **Vercel Authentication / Deployment Protection** ligado. Visitante anônimo **não vê o app** — só a tela de login da Vercel.

Isso **não** prova que o build está quebrado. Prova que o acesso público está bloqueado (ou o projeto está sob conta/time que exige SSO).

**CLI Vercel nesta máquina:** deslogada (`vercel whoami` → Logged out). Sem token não dá para puxar logs/deploys.

---

## 3. O que o Jean “perdeu” (evidência)

1. **`.env` de produção / local** — no clone limpo `Test-Path .env` = **False**. Sem:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY`
   - `VITE_SERPAPI_KEY`, Meta, Canva, etc.
2. **Cópias OneDrive divergentes e parcialmente offline**
   - `OneDrive\VITRINIX-AI-main` → arquivos “só nuvem” (erro 404 ao ler)
   - `OneDrive\Área de Trabalho\APPS\PASTAS\CLONE - VITRINEX AI - DEV\VitrineX.AI-APP` → cópia antiga (Vite 5, `version 0.0.0`, build = só `vite build`), **sem `.git` válido**
   - Paths nos logs ainda citam máquina antiga **`C:\Users\Jeanc\...`**
3. **Log da Vercel** — Jean disse que tem e vai adicionar; **ainda não estava no disco** no momento do diagnóstico.
4. Possível perda de **acesso à conta Vercel** que hospeda o alias (pode ser conta do Jean **ou** do upstream `gavtoken-design` / X-Analyser).

---

## 4. Estado do código no GitHub (fonte da verdade)

Clone feito em: `C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP`

### Build
```json
"build": "tsc -p electron/tsconfig.json && vite build"
```
- Compila **Electron** (`electron/main.ts`, `preload.ts`) **antes** do Vite.
- Na Vercel (só front estático) isso é frágil: se `electron` / types falharem, o deploy cai mesmo com o front OK.
- **Não existe `vercel.json`** no repo — Vercel detecta Vite automaticamente.
- Existe `Dockerfile` + `nginx.conf` pensados para **Cloud Run** (`deploy:cloudrun`), não para Vercel.

### `vite.config.mts` (HEAD `11f176e`)
- `base: './'`
- `manualChunks` com `react-vendor` (react, react-dom, jsx-runtime…) — histórico:
  - `b146988` removeu manualChunks (fix forwardRef)
  - `11f176e` **recolocou** chunk separado do React (outro fix forwardRef)
- PWA + gzip + brotli plugins
- `server.port = 8080`

### Páginas ativas (lazy em `App.tsx`)
Dashboard, ChatVitrineX (import existe; nome comentado em MODULE_NAMES), ContentGenerator, TrendHunter, SmartScheduler, ContentLibrary, AdStudio, CampaignBuilder, AuthPage, Settings, LandingPage, MarketRadar, SocialNetworks, IndicationsPage, AnimationShowcase, AdminGate.

### Débito / armadilhas no código
- `Dashboard.tsx` ainda chama `navigateTo('CalendarManager')` mas **CalendarManager não está no MODULE_NAMES / lazy imports** → navegação morta / possível erro em runtime.
- `NavigationItems.tsx` ainda lista `CodePlayground` (página em `src/disabled/`).
- Docs locais (`funcoes_inativas.md`, dez/2025) falam em CreativeStudio/Chatbot etc.; o HEAD atual já mudou o mapa de módulos — **docs desatualizados**.
- Segredos via `VITE_*` (viram públicos no bundle). `CanvaConnect` lê até `VITE_CANVA_CLIENT_SECRET` no client — **risco de segurança**.
- `src/lib/supabase.ts` faz fallback para placeholder se env faltar (app “sobe”, auth/dados não).

### Env esperado (`.env.example`)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
VITE_SERPAPI_KEY=
VITE_HOSTINGER_API_URL=
VITE_FB_APP_ID= / VITE_FB_PAGE_ID= / VITE_IG_USER_ID=
VITE_AUTH_REDIRECT_URI=
VITE_PINTEREST_APP_ID=
VITE_GOOGLE_DRIVE_CLIENT_ID=
VITE_CANVA_APP_ID=
```
Código também usa: `VITE_BACKEND_URL`, `VITE_CANVA_CLIENT_ID`, `VITE_CANVA_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_IG_CLIENT_ID`.

SQL: `supabase_setup.sql` + `supabase_setup_v2.sql` no root.

---

## 5. Erros encontrados nas cópias LOCAIS antigas (OneDrive / Jeanc)

Estes erros são da cópia **desatualizada**, não necessariamente do HEAD do GitHub:

1. **`vite.config.ts`:** `Unexpected "*"` em `globPatterns: ['**/*.{ js, css, ...}']` (espaços quebrando o glob no esbuild).
2. **`Could not resolve "./pages/LocalFinder"`** a partir de `App.tsx`.
3. Dezenas de erros `tsc` (`--jsx` not set, tipos Settings `phone/address/cnpj`, etc.) — muitos em path `C:\Users\Jeanc\...`.

**Conclusão:** a cópia da Área de Trabalho **não é confiável** como fonte. Preferir o clone em `Projetos\MeusApps\VitrineX.AI-APP`.

---

## 6. vitrine-de-apps (só para não confundir)

- Orquestrador local OK no disco; git `main` alinhado com origin.
- Homepage GitHub Pages: `https://jeanavila997-ux.github.io/vitrine-de-apps/`
- Deploy compartilhado antigo bloqueado (site criado como PHP, não Node); domínio perdido; plano = VPS.
- **Não** é o app de `vitrine-x-ai-app.vercel.app`.

Se o Jean quis dizer “perdi coisas da vitrine local”, o trabalho é outro (seed SQLite, `apps-registry.json`, `pages:build`). Separar tickets.

---

## 7. Plano de recuperação (Fases)

### Fase A — Acesso e verdade operacional (bloqueante)
1. Jean faz login na Vercel (conta que possui o projeto do alias `vitrine-x-ai-app`).
2. Confirmar se o projeto está ligado ao repo `jeanavila997-ux/VitrineX.AI-APP` ou ao upstream `gavtoken-design/...`.
3. Em **Settings → Deployment Protection**: desligar “Vercel Authentication” em Production **ou** adicionar o Jean como membro do time — conforme intenção (público vs privado).
4. Baixar / colar o **Build Log** do último deployment (sucesso ou falha) neste handoff ou em `logs/vercel-ultimo.log`.
5. Na máquina: `npx vercel login` e depois `npx vercel link` dentro do clone limpo + `npx vercel env pull .env.local`.

### Fase B — Build local limpo (prova que o código HEAD funciona)
```powershell
cd C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP
# criar .env a partir do exemplo + chaves reais (ou pull da Vercel)
Copy-Item .env.example .env
npm install
npm run build
```
- Se falhar no `tsc -p electron/tsconfig.json`: para Vercel, mudar script de build para só `vite build` (ou `build:standalone`) e deixar Electron fora do pipeline web.
- Se falhar no Vite: corrigir imports/chunks; **não** editar a cópia OneDrive.

Sugestão de `vercel.json` mínimo (criar se necessário):
```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Fase C — Runtime / dados
1. Validar projeto Supabase (URL + anon key) e rodar migrations (`supabase_setup_v2.sql` se for o schema atual).
2. Testar login (`AuthPage`) e uma geração Gemini (ContentGenerator) com chave válida.
3. Ajustar `VITE_AUTH_REDIRECT_URI` para `https://vitrine-x-ai-app.vercel.app` (não localhost).

### Fase D — Limpeza de navegação / código morto
1. Remover ou comentar `navigateTo('CalendarManager')` no Dashboard.
2. Tirar `CodePlayground` do menu ou religar a partir de `src/disabled/`.
3. Atualizar `funcoes_inativas.md` / README para o mapa real de módulos.
4. Tirar secrets do client (`VITE_CANVA_CLIENT_SECRET` etc.) — mover para server/edge.

### Fase E — Higiene de cópias
1. Tratar `Projetos\MeusApps\VitrineX.AI-APP` como **única fonte de trabalho**.
2. Marcar cópias OneDrive como arquivo (`_ARQUIVO-NAO-USAR`) ou apagar depois de confirmar que nada exclusivo existe lá (hashes / diff).
3. Não desenvolver em path com `Jeanc` ou “Área de Trabalho\APPS\PASTAS\CLONE…”.

### Fase F — (Opcional) vitrine-de-apps
Só se o pedido for o orquestrador local: subir `127.0.0.1:4400`, `db:seed`, revisar `deploy/ESTADO.md` / VPS.

---

## 8. Critérios de pronto

- [ ] URL abre **sem** redirect SSO (ou SSO é intencional e documentado).
- [ ] `npm run build` no clone limpo = exit 0.
- [ ] Variáveis Vercel conferidas (`vercel env ls`).
- [ ] Login Supabase + 1 call Gemini OK em produção.
- [ ] Sem links para módulos inexistentes (CalendarManager / CodePlayground).
- [ ] Jean sabe qual pasta é a canônica.

---

## 9. Comandos úteis (copiar/colar)

```powershell
# Saúde do site (espera 302 SSO ou 200)
Invoke-WebRequest https://vitrine-x-ai-app.vercel.app/ -MaximumRedirection 0 -SkipHttpErrorCheck | Select StatusCode, Headers

# 9Router (se for usar Claude/Codex/OpenCode)
Invoke-WebRequest http://127.0.0.1:20128/v1/models -TimeoutSec 5

# Claude real
& "$env:USERPROFILE\.local\bin\claude.exe"

# Vercel
npx vercel login
cd C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP
npx vercel link
npx vercel logs url https://vitrine-x-ai-app.vercel.app
npx vercel env pull .env.local
```

---

## 10. Arquivos-chave no clone

| Path | Por quê |
|---|---|
| `package.json` | script `build` com Electron |
| `vite.config.mts` | chunks / PWA / base |
| `.env.example` | lista de secrets |
| `src/App.tsx` | mapa de módulos |
| `src/lib/supabase.ts` | fallback placeholder |
| `src/pages/Dashboard.tsx` | link morto CalendarManager |
| `Dockerfile` / `nginx.conf` | caminho Cloud Run (paralelo à Vercel) |
| `supabase_setup_v2.sql` | schema |
| `deploy` N/A | sem pasta deploy Vercel |

---

## 11. Pendência do Jean (antes/durante a próxima sessão)

1. Colar o **log da Vercel** (build) neste repo: sugerido `logs/vercel-ultimo.log`.
2. Confirmar **qual conta Vercel** dona o projeto (e-mail / team).
3. Decidir: site **público** ou **protegido por login Vercel**.
4. Recuperar chaves Supabase + Gemini (cofre / dashboard), não inventar.

---

## 12. Resumo em uma frase

O alias `vitrine-x-ai-app.vercel.app` aponta para um deploy vivo mas **trancado por SSO da Vercel**; o código canônico está no fork GitHub (igual ao upstream, jan/2026) clonado em `Projetos\MeusApps\VitrineX.AI-APP`; as cópias OneDrive/Jeanc estão podres/divergentes; faltam `.env` e o log de build — próximo agente deve abrir a Vercel, puxar env, fazer build limpo sem Electron no pipeline web, e só então republicar.
