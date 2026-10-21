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
});
