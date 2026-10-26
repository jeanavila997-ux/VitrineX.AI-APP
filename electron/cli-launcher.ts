/**
 * Allowlist de CLIs de LLM que o Electron pode abrir.
 * Analogia: é a lista de convidados na festa — só quem está no papel entra.
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type CliId = 'grok' | 'gemini' | 'codex' | 'hermes' | 'pi' | 'claude' | 'omp';

export interface CliDescriptor {
  id: CliId;
  label: string;
  /** Caminhos candidatos (primeiro que existir ganha) */
  candidates: string[];
}

const home = os.homedir();
const localApp = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
const roaming = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

export const CLI_CATALOG: CliDescriptor[] = [
  {
    id: 'grok',
    label: 'Grok Build CLI',
    candidates: [
      path.join(home, '.grok', 'bin', 'grok.exe'),
      path.join(roaming, 'npm', 'grok.cmd'),
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    candidates: [
      path.join(roaming, 'npm', 'gemini.cmd'),
      path.join(roaming, 'npm', 'gemini'),
    ],
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    candidates: [
      path.join(roaming, 'npm', 'codex.cmd'),
      path.join(roaming, 'npm', 'codex.ps1'),
    ],
  },
  {
    id: 'hermes',
    label: 'Hermes CLI',
    candidates: [
      path.join(localApp, 'hermes', 'bin', 'hermes.exe'),
      path.join(roaming, 'npm', 'hermes.cmd'),
    ],
  },
  {
    id: 'pi',
    label: 'pi agent',
    candidates: [
      path.join(home, '.pi', 'agent', 'bin', 'pi.cmd'),
      path.join(home, '.pi', 'agent', 'bin', 'pi.exe'),
      path.join(roaming, 'npm', 'pi.cmd'),
    ],
  },
  {
    id: 'claude',
    label: 'Claude Code',
    candidates: [
      path.join(home, '.local', 'bin', 'claude.exe'),
      path.join(roaming, 'npm', 'claude.cmd'),
    ],
  },
  {
    id: 'omp',
    label: 'OMP',
    candidates: [path.join(localApp, 'omp', 'omp.exe')],
  },
];

export interface CliStatus {
  id: CliId;
  label: string;
  installed: boolean;
  path?: string;
}

function resolveCliPath(desc: CliDescriptor): string | undefined {
  for (const candidate of desc.candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function listCliStatus(): CliStatus[] {
  return CLI_CATALOG.map((desc) => {
    const resolved = resolveCliPath(desc);
    return {
      id: desc.id,
      label: desc.label,
      installed: !!resolved,
      path: resolved,
    };
  });
}

export interface LaunchCliResult {
  success: boolean;
  error?: string;
  path?: string;
  pid?: number;
}

/**
 * Abre a CLI num novo terminal Windows (wt.exe ou cmd /k).
 * Só aceita id allowlisted + cwd absoluto existente.
 */
export function launchCli(cliId: string, cwd?: string): LaunchCliResult {
  const desc = CLI_CATALOG.find((c) => c.id === cliId);
  if (!desc) {
    return { success: false, error: `CLI não permitida: ${cliId}` };
  }

  const exe = resolveCliPath(desc);
  if (!exe) {
    return { success: false, error: `${desc.label} não encontrado nesta máquina.` };
  }

  let workDir = cwd && path.isAbsolute(cwd) ? cwd : process.cwd();
  try {
    if (!fs.existsSync(workDir) || !fs.statSync(workDir).isDirectory()) {
      workDir = process.cwd();
    }
  } catch {
    workDir = process.cwd();
  }

  try {
    const wt = path.join(localApp, 'Microsoft', 'WindowsApps', 'wt.exe');
    let child;
    if (fs.existsSync(wt)) {
      // Windows Terminal: nova aba no diretório do projeto, rodando a CLI
      child = spawn(wt, ['new-tab', '-d', workDir, 'cmd', '/k', exe], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
    } else {
      child = spawn(
        process.env.ComSpec || 'cmd.exe',
        ['/c', 'start', '', '/D', workDir, 'cmd', '/k', exe],
        {
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
        }
      );
    }
    child.unref();
    return { success: true, path: exe, pid: child.pid };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      path: exe,
    };
  }
}
