import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveHostCommand } from '../src/host-command';

const temporaryRoots: string[] = [];

function createExecutable(name: string): { directory: string; executable: string } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-host-command-'));
  const executable = path.join(directory, name);
  writeFileSync(executable, '#!/bin/sh\n');
  chmodSync(executable, 0o755);
  temporaryRoots.push(directory);
  return { directory, executable };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('resolveHostCommand', () => {
  it('uses a resolved executable path outside Flatpak', () => {
    const { directory, executable } = createExecutable('git');

    expect(resolveHostCommand('git', directory, {}, 'linux')).toEqual({
      command: executable,
      argsPrefix: [],
    });
  });

  it('delegates commands to the host from Flatpak when flatpak-spawn is available', () => {
    const { directory, executable } = createExecutable('flatpak-spawn');

    expect(resolveHostCommand('git', directory, { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' }, 'linux')).toEqual({
      command: executable,
      argsPrefix: ['--host', 'git'],
    });
  });

  it('falls back to the command name when no executable is visible', () => {
    expect(resolveHostCommand('git', '', {}, 'linux')).toEqual({
      command: 'git',
      argsPrefix: [],
    });
  });
});
