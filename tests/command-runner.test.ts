import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CommandRunner } from '../src/command-runner';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('CommandRunner', () => {
  it('captures stdout and stderr from a successful command', async () => {
    const runner = new CommandRunner();

    const result = await runner.run(process.execPath, [
      '-e',
      "process.stdout.write('ready'); process.stderr.write('notice');",
    ]);

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'ready',
      stderr: 'notice',
    });
  });

  it('rejects with the captured output when a command exits unsuccessfully', async () => {
    const runner = new CommandRunner();

    await expect(
      runner.run(process.execPath, [
        '-e',
        "process.stderr.write('failed'); process.exitCode = 7;",
      ]),
    ).rejects.toMatchObject({
      exitCode: 7,
      stderr: 'failed',
    });
  });

  it('rejects an empty command before spawning a process', async () => {
    const runner = new CommandRunner();

    await expect(runner.run('')).rejects.toThrow('Cannot execute an empty command');
  });

  it.runIf(process.platform === 'win32')('runs Windows command shims through the shell', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-cmd-'));
    temporaryRoots.push(directory);
    const command = path.join(directory, 'aap-demo.cmd');
    writeFileSync(command, '@echo off\r\necho shim-ok\r\n');

    const result = await new CommandRunner().run(command, ['status']);

    expect(result.stdout.trim()).toBe('shim-ok');
  });

  it('streams output chunks while the command is running', async () => {
    const runner = new CommandRunner();
    const stdout: string[] = [];
    const stderr: string[] = [];

    await runner.run(
      process.execPath,
      ['-e', "process.stdout.write('out'); process.stderr.write('err');"],
      {
        onStdout: chunk => stdout.push(chunk),
        onStderr: chunk => stderr.push(chunk),
      },
    );

    expect(stdout.join('')).toBe('out');
    expect(stderr.join('')).toBe('err');
  });
});
