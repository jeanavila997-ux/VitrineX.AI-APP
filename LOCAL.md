# VitrineX local (Electron + Ollama API + 9Router fallback)

## Subir tudo

```powershell
cd C:\Users\Jean\Projetos\MeusApps\VitrineX.AI-APP
npm run local:up
# ou:
npm run electron:dev
```

Isso sobe:

1. Vite em `http://127.0.0.1:8080`
2. Janela Electron carregando esse URL
3. (via `scripts/local-up.ps1`) tenta garantir Ollama + 9Router

## Provedores de texto

Em **Configurações → Agentes locais**:

| Provedor | Endpoint | Comportamento |
|---|---|---|
| **Ollama** (default) | `http://127.0.0.1:11434/api/chat` | API **nativa** Ollama |
| + fallback | `http://127.0.0.1:20128/v1/chat/completions` | Se Ollama falhar → 9Router |
| 9Router | `:20128/v1` | Gateway direto |
| Gemini | SDK Google | só com `VITE_GEMINI_API_KEY` / `forceGemini` |

`generateText()` e `sendMessageToChat()` usam Ollama (com JSON via `format`) quando o provedor local está ativo. Tools exclusivos do Gemini (`googleSearch`) e mídia (imagem/vídeo/áudio) continuam no Google.

Docs oficiais Ollama: https://github.com/ollama/ollama/blob/main/docs/api.md

## Serviços auxiliares

```powershell
# Ollama (API nativa)
Invoke-RestMethod http://127.0.0.1:11434/api/tags

# Smoke chat
$body = @{ model = 'jev:latest'; messages = @(@{ role = 'user'; content = 'oi' }); stream = $false } | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:11434/api/chat -Method POST -ContentType 'application/json' -Body $body

# 9Router
& $env:USERPROFILE\scripts\start-9router.ps1
Invoke-RestMethod http://127.0.0.1:20128/v1/models
```

Se `/api/tags` retornar `models: []`, puxe um modelo (`ollama pull jev`) ou deixe o fallback 9Router ligado.

Chave do 9Router: lida de `Projetos\MeusApps\chat-ia\env\.env` → `VITE_9ROUTER_API_KEY` no `.env` deste projeto (gitignored).

## npm 12 / allowScripts

Este projeto declara em `package.json`:

```json
"allowScripts": { "electron": true, "esbuild": true, "core-js": true, "protobufjs": true }
```

Sem isso o Electron não baixa o binário e o app quebra com erros estranhos em `joi`/módulos nativos.

## Comandos úteis

| Script | Função |
|---|---|
| `npm run electron:dev` | Vite + Electron juntos |
| `npm run electron:open` | Só Electron (Vite já precisa estar no ar) |
| `npm run electron:compile` | Compila `electron/*.ts` → `dist-electron/` |
| `npm run local:up` | Ollama + 9Router + Electron |
| `npm run build:web` | Build estático sem Electron |
