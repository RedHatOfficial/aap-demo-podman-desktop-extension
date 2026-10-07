import { describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandResult } from '../src/command-runner';
import { hasHostOpenAiKey } from '../src/ao-key';

describe('hasHostOpenAiKey', () => {
  it('checks the configured key file on the Flatpak host', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-ao-key-'));
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

    await expect(hasHostOpenAiKey(
      executor,
      '/home/test/.aap-demo/ao/llm-api-key',
      directory,
      { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
    )).resolves.toBe(true);

    expect(calls[0]).toEqual({
      command: flatpakSpawn,
      args: ['--host', '/usr/bin/test', '-s', '/home/test/.aap-demo/ao/llm-api-key'],
    });
    rmSync(directory, { recursive: true, force: true });
  });
});
