import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { activate } from '../src/extension';
import {
  mockPodmanDesktopState,
  resetMockPodmanDesktopApi,
  window,
} from './fixtures/podman-desktop-api';

const temporaryRoots: string[] = [];

function createCliExecutable(root: string): { executable: string; logFile: string } {
  const logFile = path.join(root, 'cli-calls.log');
  const executable = path.join(root, process.platform === 'win32' ? 'aap-demo.cmd' : 'aap-demo');
  const script = process.platform === 'win32'
    ? [
      '@echo off',
      `echo %1>>"${logFile}"`,
      'if "%1"=="status" echo Cluster: stopped',
      'exit /b 0',
      '',
    ].join('\r\n')
    : [
      '#!/bin/sh',
      `printf '%s\\n' "$1" >> '${logFile}'`,
      'if [ "$1" = "status" ]; then printf "%s\\n" "Cluster: stopped"; fi',
      '',
    ].join('\n');
  writeFileSync(executable, script);
  chmodSync(executable, 0o755);
  return { executable, logFile };
}

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

  it('prompts for a missing pull secret before starting the VM', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-extension-activation-'));
    temporaryRoots.push(root);
    const { executable, logFile } = createCliExecutable(root);
    mockPodmanDesktopState.configuration = {
      cliPath: executable,
      crcPath: path.join(root, 'missing-crc'),
      openDashboardOnStartup: false,
      pullSecretPath: path.join(root, 'missing-pull-secret.txt'),
    };
    const subscriptions: Array<{ dispose?: () => void }> = [];

    await activate({
      extensionUri: { fsPath: root },
      subscriptions,
    } as never);

    await mockPodmanDesktopState.commandHandlers.get('aap-demo.start')?.();

    expect(window.showInputBox).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Red Hat pull secret',
    }));
    expect(readFileSync(logFile, 'utf8')).not.toContain('start');
  });
});
