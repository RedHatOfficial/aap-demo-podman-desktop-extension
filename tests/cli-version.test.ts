import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandResult, CommandRunnerOptions } from '../src/command-runner';
import { detectCliVersion, parseCliVersion } from '../src/cli-version';
import type { CommandExecutor } from '../src/aap-demo-service';

const temporaryRoots: string[] = [];

function createExecutable(name: string): { directory: string; executable: string } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-version-'));
  const executable = path.join(directory, name);
  writeFileSync(executable, '#!/bin/sh\n');
  chmodSync(executable, 0o755);
  temporaryRoots.push(directory);
  return { directory, executable };
}

class VersionExecutor implements CommandExecutor {
  public readonly calls: Array<{
    command: string;
    args: readonly string[];
    options?: CommandRunnerOptions;
  }> = [];

  constructor(private readonly result: CommandResult | Error) {}

  async run(
    command: string,
    args: readonly string[] = [],
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    this.calls.push({ command, args, ...(options ? { options } : {}) });
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('parseCliVersion', () => {
  it('extracts a semantic version from the CLI banner', () => {
    expect(parseCliVersion('aap-demo 1.0.48\n  built: 2026-10-01')).toBe('1.0.48');
  });

  it('removes a leading v from a version string', () => {
    expect(parseCliVersion('aap-demo v1.2.3')).toBe('1.2.3');
  });

  it('returns unknown when no semantic version is reported', () => {
    expect(parseCliVersion('aap-demo development build')).toBe('unknown');
  });
});

describe('detectCliVersion', () => {
  it('runs the configured CLI with --version', async () => {
    const executor = new VersionExecutor({
      exitCode: 0,
      stdout: 'aap-demo 1.0.48\n',
      stderr: '',
    });

    await expect(detectCliVersion(executor, '/custom/aap-demo')).resolves.toBe('1.0.48');
    expect(executor.calls).toEqual([{ command: '/custom/aap-demo', args: ['--version'] }]);
  });

  it('does not prevent extension activation when version detection fails', async () => {
    const executor = new VersionExecutor(new Error('not found'));

    await expect(detectCliVersion(executor, 'aap-demo')).resolves.toBe('unknown');
  });

  it('detects the CLI version through the host when Podman Desktop is sandboxed as a Flatpak', async () => {
    const { directory, executable } = createExecutable('flatpak-spawn');
    const executor = new VersionExecutor({
      exitCode: 0,
      stdout: 'aap-demo 1.0.48\n',
      stderr: '',
    });

    await expect(detectCliVersion(
      executor,
      '/home/test/.local/bin/aap-demo',
      directory,
      { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
    )).resolves.toBe('1.0.48');

    expect(executor.calls).toEqual([{
      command: executable,
      args: ['--host', '/home/test/.local/bin/aap-demo', '--version'],
    }]);
  });
});
