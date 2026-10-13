import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { activate } from '../src/extension';
import {
  mockPodmanDesktopState,
  resetMockPodmanDesktopApi,
} from './fixtures/podman-desktop-api';

const temporaryRoots: string[] = [];

beforeEach(() => {
  resetMockPodmanDesktopApi();
});

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('extension activation', () => {
  it('reports a missing CLI through the registered command and status item', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-extension-activation-'));
    temporaryRoots.push(root);
    const configuredCliPath = path.join(root, 'missing-aap-demo');
    mockPodmanDesktopState.configuration = {
      cliPath: configuredCliPath,
      crcPath: path.join(root, 'missing-crc'),
      openDashboardOnStartup: false,
    };
    const subscriptions: Array<{ dispose?: () => void }> = [];

    await activate({
      extensionUri: { fsPath: root },
      subscriptions,
    } as never);

    await mockPodmanDesktopState.commandHandlers.get('aap-demo.create')?.();

    expect(mockPodmanDesktopState.statusBar.text).toBe('AAP Demo: CLI missing');
    expect(mockPodmanDesktopState.statusBar.tooltip).toContain(configuredCliPath);
    expect(mockPodmanDesktopState.warningMessages).toEqual([
      expect.stringContaining('Install aap-demo'),
    ]);
  });
});
