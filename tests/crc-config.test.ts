import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CommandResult, CommandRunnerOptions } from '../src/command-runner';
import { applyCrcResourceSettings, type CrcCommandExecutor } from '../src/crc-config';

class RecordingExecutor implements CrcCommandExecutor {
  public readonly calls: Array<{
    command: string;
    args: readonly string[];
    options?: CommandRunnerOptions;
  }> = [];

  async run(
    command: string,
    args: readonly string[],
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    this.calls.push({ command, args, ...(options ? { options } : {}) });
    return { exitCode: 0, stdout: '', stderr: '' };
  }
}

describe('applyCrcResourceSettings', () => {
  it('pushes configured CPU and memory values into CRC config', async () => {
    const executor = new RecordingExecutor();

    await applyCrcResourceSettings(executor, 'crc', {
      cpus: 8,
      memory: 24_576,
      pathValue: '/usr/local/bin:/usr/bin',
      environment: {},
    });

    expect(executor.calls.map(call => call.args)).toEqual([
      ['config', 'set', 'cpus', '8'],
      ['config', 'set', 'memory', '24576'],
    ]);
    expect(executor.calls[0]?.options?.env).toMatchObject({
      PATH: '/usr/local/bin:/usr/bin',
      QUIET: 'true',
    });
  });

  it('forwards the augmented PATH through the Flatpak host bridge', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-crc-flatpak-'));
    const flatpakSpawn = path.join(directory, 'flatpak-spawn');
    writeFileSync(flatpakSpawn, '#!/bin/sh\n');
    chmodSync(flatpakSpawn, 0o755);
    const executor = new RecordingExecutor();

    try {
      await applyCrcResourceSettings(executor, '/home/test/.crc/bin/crc', {
        cpus: 8,
        environment: { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
        pathValue: directory,
      });
      expect(executor.calls[0]?.args).toEqual([
        `--env=PATH=${directory}`,
        '--host',
        '/home/test/.crc/bin/crc',
        'config',
        'set',
        'cpus',
        '8',
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fails clearly when Flatpak host execution is unavailable', async () => {
    await expect(applyCrcResourceSettings(
      new RecordingExecutor(),
      'crc',
      {
        cpus: 8,
        environment: { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
        pathValue: '/tmp/no-flatpak-spawn',
      },
    )).rejects.toThrow('flatpak-spawn');
  });
});
