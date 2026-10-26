# Prompt para colar no Claude Code / Codex

Você é o agente que **continua** um diagnóstico já feito. Não redescubra o óbvio.

1. Leia por completo:
   `C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP\HANDOFF-DIAGNOSTICO-2026-10-25.md`
2. Trabalhe **só** no VitrineX AI nesse path. Ignore `vitrine-de-apps` salvo se o Jean pedir explicitamente.
3. Responda em **pt-BR**, modo professor (explique o porquê).
4. Ordem obrigatória:
   - Fase A: acesso Vercel + Deployment Protection + env
   - Fase B: `npm run build` no clone limpo; se Electron quebrar o pipeline, separe o build web
   - Só depois: redeploy / correções de navegação
5. Se o Jean colar um log Vercel, ele manda nas hipóteses deste handoff.
6. Não apague cópias OneDrive sem confirmação. Não invente API keys.

Contexto máquina: `C:\Users\Jean\AGENTS.md`. Claude do PATH está quebrado → use `C:\Users\Jean\.local\bin\claude.exe`. 9Router em `127.0.0.1:20128`.
