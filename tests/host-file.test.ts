import { describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandResult } from '../src/command-runner';
import { hasHostFile } from '../src/host-file';

describe('hasHostFile', () => {
  it('checks a file on the Flatpak host', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-flatpak-'));
    const flatpakSpawn = path.join(directory, 'flatpak-spawn');
    writeFileSync(flatpakSpawn, '#!/bin/sh\n');
    chmodSync(flatpakSpawn, 0o755);
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const executor = {
      async run(command: string, args: readonly string[]): Promise<CommandResult> {
        calls.push({ command, args });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    await expect(hasHostFile(
      executor,
      '/home/test/.aap-demo/galaxy-token',
      directory,
      { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
    )).resolves.toBe(true);

    expect(calls[0]).toEqual({
      command: flatpakSpawn,
      args: ['--host', '/usr/bin/test', '-s', '/home/test/.aap-demo/galaxy-token'],
    });
    rmSync(directory, { recursive: true, force: true });
  });

  it('returns false when the host file check fails', async () => {
    const executor = {
      async run(): Promise<CommandResult> {
        throw new Error('missing');
      },
    };

    await expect(hasHostFile(
      executor,
      '/home/test/.aap-demo/galaxy-token',
      '/tmp/bin',
      { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
    )).resolves.toBe(false);
  });

  it('checks a local file when the extension is not sandboxed', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-token-'));
    const tokenFile = path.join(directory, 'galaxy-token');
    writeFileSync(tokenFile, 'token');

    await expect(hasHostFile(
      { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
      tokenFile,
      '/tmp/bin',
      {},
    )).resolves.toBe(true);

    rmSync(directory, { recursive: true, force: true });
  });
});
