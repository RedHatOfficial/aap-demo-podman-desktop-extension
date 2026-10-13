import { vi } from 'vitest';
import * as path from 'node:path';

export const mockPodmanDesktopState = {
  configuration: {} as Record<string, unknown>,
  commandHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  statusBar: {
    text: '',
    tooltip: '',
    command: '',
    show: vi.fn(),
    dispose: vi.fn(),
  },
  warningMessages: [] as string[],
};

export function resetMockPodmanDesktopApi(configuration: Record<string, unknown> = {}): void {
  mockPodmanDesktopState.configuration = configuration;
  mockPodmanDesktopState.commandHandlers.clear();
  mockPodmanDesktopState.warningMessages.length = 0;
  Object.assign(mockPodmanDesktopState.statusBar, {
    text: '',
    tooltip: '',
    command: '',
  });
  vi.clearAllMocks();
}

export const StatusBarAlignLeft = 0;

export const cli = {
  createCliTool: vi.fn(() => ({ dispose: vi.fn() })),
};

export const commands = {
  registerCommand: vi.fn((name: string, handler: (...args: unknown[]) => unknown) => {
    mockPodmanDesktopState.commandHandlers.set(name, handler);
    return { dispose: vi.fn() };
  }),
  executeCommand: vi.fn(async (name: string, ...args: unknown[]) => {
    return mockPodmanDesktopState.commandHandlers.get(name)?.(...args);
  }),
};

export const configuration = {
  getConfiguration: vi.fn(() => ({
    get: <T>(key: string, fallback: T): T => (
      mockPodmanDesktopState.configuration[key] as T | undefined
    ) ?? fallback,
    update: vi.fn(async () => undefined),
  })),
};

export const extensions = {
  getExtension: vi.fn(() => undefined),
  onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
};

export const window = {
  createStatusBarItem: vi.fn(() => mockPodmanDesktopState.statusBar),
  showWarningMessage: vi.fn(async (message: string) => {
    mockPodmanDesktopState.warningMessages.push(message);
    return undefined;
  }),
  showInformationMessage: vi.fn(async () => undefined),
  showInputBox: vi.fn(async () => undefined),
  createWebviewPanel: vi.fn(),
};

export const Uri = {
  joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
    fsPath: path.join(base.fsPath, ...segments),
  }),
  parse: (value: string) => value,
};

export const navigation = {
  navigateToExtensionsCatalog: vi.fn(async () => undefined),
  navigateToResources: vi.fn(async () => undefined),
};

export const env = {
  openExternal: vi.fn(async () => true),
};
