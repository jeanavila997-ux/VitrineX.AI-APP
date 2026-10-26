import { contextBridge, ipcRenderer } from 'electron';

export type CliId = 'grok' | 'gemini' | 'codex' | 'hermes' | 'pi' | 'claude' | 'omp';

export interface CliStatus {
  id: CliId;
  label: string;
  installed: boolean;
  path?: string;
}

const electronAPI = {
  saveFile: (imageUrl: string, fileName: string) =>
    ipcRenderer.invoke('save-file', imageUrl, fileName) as Promise<{
      success: boolean;
      path?: string;
      error?: string;
    }>,

  listCliTools: () => ipcRenderer.invoke('cli:list') as Promise<CliStatus[]>,

  /** Abre CLI após diálogo de permissão no processo main */
  launchCli: (cliId: CliId | string) =>
    ipcRenderer.invoke('cli:launch', cliId) as Promise<{
      success: boolean;
      error?: string;
      path?: string;
      pid?: number;
    }>,

  getProjectRoot: () => ipcRenderer.invoke('local:get-project-root') as Promise<string>,

  openExternal: (url: string) =>
    ipcRenderer.invoke('local:open-external', url) as Promise<{ success: boolean; error?: string }>,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
