import * as React from 'react';
import Button from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';
import {
  getLocalProviderConfig,
  setLocalProvider,
  setFallbackToRouter,
  probeLocalProviders,
  testLocalConnection,
  listOllamaModels,
  type LocalAiProviderId,
} from '../../services/ai/localProvider';

type CliStatus = {
  id: string;
  label: string;
  installed: boolean;
  path?: string;
};

const PROVIDERS: Array<{ id: LocalAiProviderId; label: string; hint: string }> = [
  { id: 'ollama', label: 'Ollama (API nativa)', hint: 'POST /api/chat em :11434 — principal' },
  { id: '9router', label: '9Router', hint: 'Gateway :20128 — usar direto (sem passar pelo Ollama)' },
  { id: 'gemini', label: 'Gemini (cloud)', hint: 'SDK Google — precisa de VITE_GEMINI_API_KEY' },
];

const LocalAgentsSection: React.FC = () => {
  const { addToast } = useToast();
  const [provider, setProviderState] = React.useState<LocalAiProviderId>('ollama');
  const [model, setModel] = React.useState('');
  const [fallbackRouter, setFallbackRouterState] = React.useState(true);
  const [ollamaModels, setOllamaModels] = React.useState<string[]>([]);
  const [probe, setProbe] = React.useState<{
    ollama: { ok: boolean; detail: string };
    router: { ok: boolean; detail: string };
  } | null>(null);
  const [clis, setClis] = React.useState<CliStatus[]>([]);
  const [busy, setBusy] = React.useState(false);
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.listCliTools;

  React.useEffect(() => {
    const cfg = getLocalProviderConfig();
    setProviderState(cfg.provider);
    setFallbackRouterState(cfg.fallbackToRouter);
    setModel(cfg.provider === '9router' ? cfg.routerModel : cfg.ollamaModel);
    void refreshStatus();
  }, []);

  const refreshStatus = async () => {
    setBusy(true);
    try {
      const status = await probeLocalProviders();
      setProbe(status);
      try {
        setOllamaModels(await listOllamaModels());
      } catch {
        setOllamaModels([]);
      }
      if (window.electronAPI?.listCliTools) {
        setClis(await window.electronAPI.listCliTools());
      }
    } finally {
      setBusy(false);
    }
  };

  const saveProvider = (next: LocalAiProviderId) => {
    setProviderState(next);
    const cfg = getLocalProviderConfig();
    const defaultModel = next === '9router' ? cfg.routerModel : next === 'ollama' ? cfg.ollamaModel : '';
    setModel(defaultModel);
    setLocalProvider(next, defaultModel || undefined);
    addToast({
      type: 'success',
      title: 'Provedor salvo',
      message: `Agora o generateText usa: ${next}`,
    });
  };

  const saveModel = () => {
    setLocalProvider(provider, model.trim() || undefined);
    addToast({ type: 'success', title: 'Modelo salvo', message: model || '(default do .env)' });
  };

  const runTest = async () => {
    setBusy(true);
    try {
      if (provider === 'gemini') {
        addToast({
          type: 'info',
          title: 'Gemini',
          message: 'Use o painel Admin / chave Gemini para testar o cloud.',
        });
        return;
      }
      const text = await testLocalConnection();
      addToast({ type: 'success', title: 'Conexão OK', message: text.slice(0, 180) });
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Falha no teste',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const openCli = async (id: string) => {
    if (!window.electronAPI?.launchCli) {
      addToast({
        type: 'error',
        title: 'Só no Electron',
        message: 'Abrir CLIs exige o app desktop (npm run electron:dev).',
      });
      return;
    }
    const result = await window.electronAPI.launchCli(id);
    if (result.success) {
      addToast({ type: 'success', title: 'CLI aberta', message: result.path || id });
    } else {
      addToast({
        type: 'error',
        title: 'Não abriu',
        message: result.error || 'Falha desconhecida',
      });
    }
  };

  return (
    <section id="local-agents-section" className="space-y-6">
      <div className="glass-card p-6 border border-[var(--border-default)]">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Agentes locais</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Texto do app usa a <strong>API nativa do Ollama</strong> (<code className="text-xs">/api/chat</code>).
          Se o Ollama falhar (sem modelo, timeout…), o app tenta o <strong>9Router</strong> automaticamente.
          No Electron, libere a abertura das CLIs (Grok, Gemini, Codex, Hermes, pi…).
        </p>

        <div className="grid gap-3 md:grid-cols-3 mb-6">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => saveProvider(p.id)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                provider === p.id
                  ? 'border-cyan-500/60 bg-cyan-500/10'
                  : 'border-[var(--border-default)] hover:bg-[var(--background-input)]'
              }`}
            >
              <div className="font-semibold text-[var(--text-primary)]">{p.label}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">{p.hint}</div>
            </button>
          ))}
        </div>

        {provider === 'ollama' && (
          <label className="flex items-start gap-3 mb-6 cursor-pointer rounded-xl border border-[var(--border-default)] p-4">
            <input
              type="checkbox"
              className="mt-1"
              checked={fallbackRouter}
              onChange={(e) => {
                const next = e.target.checked;
                setFallbackRouterState(next);
                setFallbackToRouter(next);
                addToast({
                  type: 'success',
                  title: 'Fallback',
                  message: next
                    ? 'Se o Ollama falhar, usa 9Router'
                    : 'Só Ollama — sem fallback',
                });
              }}
            />
            <span>
              <span className="font-medium text-[var(--text-primary)] block">
                Fallback automático → 9Router
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Recomendado. Útil quando a lista de modelos do Ollama está vazia ou um modelo :cloud falha.
              </span>
            </span>
          </label>
        )}

        {provider !== 'gemini' && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <label className="text-xs text-[var(--text-secondary)]">Modelo</label>
              {provider === 'ollama' && ollamaModels.length > 0 ? (
                <select
                  className="mt-1 w-full rounded-lg bg-[var(--background-input)] border border-[var(--border-default)] px-3 py-2 text-sm"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {ollamaModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="mt-1 w-full rounded-lg bg-[var(--background-input)] border border-[var(--border-default)] px-3 py-2 text-sm"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider === '9router' ? 'cx/gpt-5.6-sol' : 'jev:latest'}
                />
              )}
              {provider === 'ollama' && ollamaModels.length === 0 && (
                <p className="text-[10px] text-amber-400 mt-1">
                  Nenhum modelo listado em /api/tags. Com fallback ligado, o teste deve cair no 9Router.
                </p>
              )}
            </div>
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={saveModel} disabled={busy}>
                Salvar modelo
              </Button>
              <Button variant="liquid" onClick={runTest} disabled={busy}>
                Testar
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[var(--text-primary)]">Saúde dos serviços</h3>
          <Button variant="ghost" size="sm" onClick={refreshStatus} disabled={busy}>
            Atualizar
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 mb-8">
          <div className="rounded-xl border border-[var(--border-default)] p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <span className={`h-2.5 w-2.5 rounded-full ${probe?.ollama.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
              Ollama · 127.0.0.1:11434
            </div>
            <p className="text-[var(--text-secondary)] mt-2 text-xs break-words">
              {probe?.ollama.detail || '—'}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <span className={`h-2.5 w-2.5 rounded-full ${probe?.router.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
              9Router · 127.0.0.1:20128
            </div>
            <p className="text-[var(--text-secondary)] mt-2 text-xs break-words">
              {probe?.router.detail || '—'}
            </p>
          </div>
        </div>

        <h3 className="font-semibold text-[var(--text-primary)] mb-2">Abrir CLIs (com permissão)</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          {isElectron
            ? 'Cada clique pede confirmação na janela do sistema antes de abrir o terminal.'
            : 'Rode o app via Electron para habilitar estes botões.'}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(clis.length
            ? clis
            : [
                { id: 'grok', label: 'Grok Build CLI', installed: false },
                { id: 'gemini', label: 'Gemini CLI', installed: false },
                { id: 'codex', label: 'Codex CLI', installed: false },
                { id: 'hermes', label: 'Hermes CLI', installed: false },
                { id: 'pi', label: 'pi agent', installed: false },
                { id: 'claude', label: 'Claude Code', installed: false },
                { id: 'omp', label: 'OMP', installed: false },
              ]
          ).map((cli) => (
            <button
              key={cli.id}
              type="button"
              disabled={!isElectron || !cli.installed}
              onClick={() => openCli(cli.id)}
              className="rounded-xl border border-[var(--border-default)] p-3 text-left text-sm disabled:opacity-40 hover:bg-[var(--background-input)]"
              title={cli.path || 'Não instalado'}
            >
              <div className="font-medium text-[var(--text-primary)]">{cli.label}</div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-1 truncate">
                {cli.installed ? cli.path : 'não instalado'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LocalAgentsSection;
