import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandExecutor } from '../src/aap-demo-service';
import type { CommandResult, CommandRunnerOptions } from '../src/command-runner';
import { canInvokeCli, missingCliMessage, shouldAutomaticallyInstallCli } from '../src/cli-readiness';

const temporaryRoots: string[] = [];

function createExecutable(name: string): { directory: string; executable: string } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-cli-readiness-'));
  const executable = path.join(directory, name);
  writeFileSync(executable, '#!/bin/sh\n');
  chmodSync(executable, 0o755);
  temporaryRoots.push(directory);
  return { directory, executable };
}

class RecordingExecutor implements CommandExecutor {
  public readonly calls: Array<{ command: string; args: readonly string[] }> = [];

  constructor(private readonly fail = false) {}

  async run(
    command: string,
    args: readonly string[] = [],
    _options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    this.calls.push({ command, args });
    if (this.fail) throw new Error('host command not found');
    return { exitCode: 0, stdout: '', stderr: '' };
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('missingCliMessage', () => {
  it('explains how to install the default CLI', () => {
    const message = missingCliMessage('aap-demo');

    expect(message).toContain('aap-demo');
    expect(message).toContain('Install aap-demo');
    expect(message).toContain('aap-demo.cliPath');
  });

  it('preserves a custom configured path for troubleshooting', () => {
    expect(missingCliMessage('/custom/aap-demo')).toContain('/custom/aap-demo');
  });
});

describe('canInvokeCli', () => {
  it('checks that the configured CLI exists on the host through Flatpak', async () => {
    const { directory, executable } = createExecutable('flatpak-spawn');
    const executor = new RecordingExecutor();

    await expect(canInvokeCli(
      'aap-demo',
      directory,
      { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
      'linux',
      executor,
    )).resolves.toBe(true);

    expect(executor.calls).toEqual([{
      command: executable,
      args: [
        `--env=PATH=${directory}`,
        '--host',
        'sh',
        '-c',
        'command -v "$1" >/dev/null 2>&1',
        'aap-demo-cli-check',
        'aap-demo',
      ],
    }]);
  });

  it('treats a missing host CLI as unavailable when the Flatpak bridge is present', async () => {
    const { directory } = createExecutable('flatpak-spawn');
    const executor = new RecordingExecutor(true);

    await expect(canInvokeCli(
      'aap-demo',
      directory,
      { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
      'linux',
      executor,
    )).resolves.toBe(false);
  });

  it('checks non-Flatpak executables locally without probing the host', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-cli-readiness-'));
    temporaryRoots.push(directory);
    const executor = new RecordingExecutor();

    await expect(canInvokeCli(
      path.join(directory, 'missing-aap-demo'),
      directory,
      {},
      'linux',
      executor,
    )).resolves.toBe(false);
    expect(executor.calls).toEqual([]);
  });
});

describe('shouldAutomaticallyInstallCli', () => {
  it('repairs the default CLI in Flatpak when the install script exists', () => {
    expect(shouldAutomaticallyInstallCli({
      action: 'status',
      configuredPath: 'aap-demo',
      flatpakId: 'io.podman_desktop.PodmanDesktop',
      installScriptAvailable: true,
      repairAlreadyAttempted: false,
    })).toBe(true);
  });

  it('does not auto-run the installer for custom paths or repeated attempts', () => {
    const options = {
      action: 'status' as const,
      configuredPath: 'aap-demo',
      flatpakId: 'io.podman_desktop.PodmanDesktop',
      installScriptAvailable: true,
      repairAlreadyAttempted: false,
    };

    expect(shouldAutomaticallyInstallCli({ ...options, configuredPath: '/custom/aap-demo' })).toBe(false);
    expect(shouldAutomaticallyInstallCli({ ...options, repairAlreadyAttempted: true })).toBe(false);
    expect(shouldAutomaticallyInstallCli({ ...options, installScriptAvailable: false })).toBe(false);
    expect(shouldAutomaticallyInstallCli({ ...options, flatpakId: undefined })).toBe(false);
    expect(shouldAutomaticallyInstallCli({ ...options, action: 'start' })).toBe(false);
  });
});
