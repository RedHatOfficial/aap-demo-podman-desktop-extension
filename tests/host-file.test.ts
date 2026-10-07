import { describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandResult } from '../src/command-runner';
import { hasHostFile, saveHostFile } from '../src/host-file';

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

  it('saves a token locally with restricted permissions', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-token-'));
    const tokenFile = path.join(directory, 'nested', 'galaxy-token');

    await saveHostFile(
      { run: async () => ({ exitCode: 0, stdout: '', stderr: '' }) },
      tokenFile,
      '/tmp/bin',
      {},
      'offline-token',
    );

    expect(readFileSync(tokenFile, 'utf8')).toBe('offline-token');
    expect(existsSync(tokenFile)).toBe(true);
    rmSync(directory, { recursive: true, force: true });
  });

  it('saves a token through the Flatpak host using standard input', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-flatpak-'));
    const flatpakSpawn = path.join(directory, 'flatpak-spawn');
    writeFileSync(flatpakSpawn, '#!/bin/sh\n');
    chmodSync(flatpakSpawn, 0o755);
    const calls: Array<{ command: string; args: readonly string[]; input?: string }> = [];
    const executor = {
      async run(command: string, args: readonly string[], options?: { input?: string }): Promise<CommandResult> {
        calls.push({ command, args, input: options?.input });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    await saveHostFile(
      executor,
      '/home/test/.aap-demo/galaxy-token',
      directory,
      { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
      'offline-token',
    );

    expect(calls[0]).toEqual({
      command: flatpakSpawn,
      args: [
        '--host',
        '/bin/sh',
        '-c',
        'umask 077; mkdir -p "$1"; cat > "$1/$2"; chmod 600 "$1/$2"',
        'aap-demo-token',
        '/home/test/.aap-demo',
        'galaxy-token',
      ],
      input: 'offline-token',
    });
    rmSync(directory, { recursive: true, force: true });
  });
});
