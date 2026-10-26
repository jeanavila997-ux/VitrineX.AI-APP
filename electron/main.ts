import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { launchCli, listCliStatus } from './cli-launcher';

interface SaveFileResponse {
  success: boolean;
  path?: string;
  error?: string;
}

const WINDOW_CONFIG = {
  width: 1400,
  height: 900,
  minWidth: 1024,
  minHeight: 700,
  icon: path.join(__dirname, '../public/favicon.ico'),
};

const isDev = !app.isPackaged;
const PROJECT_ROOT = path.join(__dirname, '..');

function createWindow(): void {
  const win = new BrowserWindow({
    ...WINDOW_CONFIG,
    autoHideMenuBar: true,
    title: 'VitrineX.AI (local)',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:8080';

  if (isDev) {
    win.loadURL(devUrl).catch((err) => {
      console.error(`Falha ao carregar ${devUrl}. Suba o Vite antes (npm run dev).`, err);
      dialog.showErrorBox(
        'Vite não respondeu',
        `Não foi possível abrir ${devUrl}.\nRode: npm run electron:dev (sobe Vite + Electron).`
      );
    });
    // DevTools: descomente se precisar depurar
    // win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const distIndex = path.join(__dirname, '../dist/index.html');
    const altDistIndex = path.join(__dirname, '../../dist/index.html');
    if (fs.existsSync(distIndex)) {
      win.loadFile(distIndex);
    } else if (fs.existsSync(altDistIndex)) {
      win.loadFile(altDistIndex);
    } else {
      console.error('CRITICAL: index.html não encontrado em', distIndex);
    }
  }
}

async function handleSaveFile(
  _event: IpcMainInvokeEvent,
  content: string,
  defaultFilename: string
): Promise<SaveFileResponse> {
  const window = BrowserWindow.getFocusedWindow();
  if (!window) return { success: false, error: 'No focused window' };

  const { canceled, filePath } = await dialog.showSaveDialog(window, {
    title: 'Salvar arquivo',
    defaultPath: defaultFilename,
    buttonLabel: 'Salvar',
  });

  if (canceled || !filePath) {
    return { success: false, error: 'Save canceled' };
  }

  try {
    if (typeof content === 'string' && content.startsWith('data:')) {
      const base64Data = content.split(';base64,').pop();
      if (base64Data) {
        fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
      } else {
        fs.writeFileSync(filePath, content);
      }
    } else {
      fs.writeFileSync(filePath, content);
    }
    return { success: true, path: filePath };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Pede confirmação antes de abrir qualquer CLI (permissão explícita do usuário).
 */
async function handleLaunchCli(
  _event: IpcMainInvokeEvent,
  cliId: string
): Promise<{ success: boolean; error?: string; path?: string; pid?: number }> {
  const win = BrowserWindow.getFocusedWindow();
  const statuses = listCliStatus();
  const target = statuses.find((s) => s.id === cliId);

  const { response } = await dialog.showMessageBox(win || undefined!, {
    type: 'question',
    buttons: ['Cancelar', 'Abrir'],
    defaultId: 1,
    cancelId: 0,
    title: 'Permissão para abrir CLI',
    message: `Abrir ${target?.label || cliId}?`,
    detail:
      'O VitrineX vai abrir um terminal novo com essa ferramenta de LLM.\n' +
      `Caminho: ${target?.path || '(não instalado)'}\n` +
      `Pasta de trabalho: ${PROJECT_ROOT}`,
  });

  if (response !== 1) {
    return { success: false, error: 'Permissão negada pelo usuário.' };
  }

  return launchCli(cliId, PROJECT_ROOT);
}

function setupIpcHandlers(): void {
  ipcMain.handle('save-file', handleSaveFile);
  ipcMain.handle('cli:list', async () => listCliStatus());
  ipcMain.handle('cli:launch', handleLaunchCli);
  ipcMain.handle('local:get-project-root', async () => PROJECT_ROOT);
  ipcMain.handle('local:open-external', async (_e, url: string) => {
    if (typeof url !== 'string') return { success: false, error: 'URL inválida' };
    // Só http(s) e alguns deep-links locais
    if (!/^https?:\/\//i.test(url) && !/^vscode:\/\//i.test(url)) {
      return { success: false, error: 'Esquema de URL não permitido' };
    }
    await shell.openExternal(url);
    return { success: true };
  });
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

