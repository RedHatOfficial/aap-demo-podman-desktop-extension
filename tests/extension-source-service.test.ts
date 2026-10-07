import { describe, expect, it } from 'vitest';
import type { CommandResult, CommandRunnerOptions } from '../src/command-runner';
import {
  AAP_DEMO_EXTENSION_REPOSITORY_URL,
  ExtensionSourceService,
  MissingRuntimeError,
} from '../src/extension-source-service';

class RecordingExecutor {
  readonly calls: Array<{
    command: string;
    args: readonly string[];
    options?: CommandRunnerOptions;
  }> = [];

  constructor(
    private readonly output: Record<string, string> = {},
    private readonly failedCommand?: string,
    private readonly failureMessage?: string,
  ) {}

  async run(
    command: string,
    args: readonly string[] = [],
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    this.calls.push({ command, args, ...(options ? { options } : {}) });
    const key = [command, ...args].join(' ');
    if (key === this.failedCommand) throw new Error(this.failureMessage ?? `failed command: ${key}`);
    return { exitCode: 0, stdout: this.output[key] ?? '', stderr: '' };
  }
}

function createService(
  executor: RecordingExecutor,
  exists = false,
  gitMetadataExists = false,
  platform: NodeJS.Platform = process.platform,
): ExtensionSourceService {
  return new ExtensionSourceService(executor, {
    checkoutPath: '/home/test/.aap-demo-podman-desktop-extension',
    pathValue: '/custom/bin:/usr/bin:/bin',
    pathExists: () => exists,
    gitMetadataExists: () => gitMetadataExists,
    platform,
  });
}

describe('ExtensionSourceService', () => {
  it('clones, checks the runtimes, installs dependencies, and builds', async () => {
    const executor = new RecordingExecutor({
      'node --version': 'v24.0.0',
      'npm --version': '11.0.0',
    });

    await createService(executor, false, false, 'linux').prepare();

    expect(executor.calls.map(({ command, args }) => [command, ...args])).toEqual([
      ['git', 'clone', AAP_DEMO_EXTENSION_REPOSITORY_URL, '/home/test/.aap-demo-podman-desktop-extension'],
      ['node', '--version'],
      ['npm', '--version'],
      ['npm', 'ci'],
      ['npm', 'run', 'build'],
    ]);
    expect(executor.calls.every(call => call.options?.env?.PATH === '/custom/bin:/usr/bin:/bin')).toBe(true);
    expect(executor.calls.slice(-2).every(
      call => call.options?.cwd === '/home/test/.aap-demo-podman-desktop-extension',
    )).toBe(true);
  });

  it('fast-forwards an existing checkout only when its origin is official', async () => {
    const executor = new RecordingExecutor({
      'git -C /home/test/.aap-demo-podman-desktop-extension remote get-url origin':
        AAP_DEMO_EXTENSION_REPOSITORY_URL,
      'git -C /home/test/.aap-demo-podman-desktop-extension rev-parse --abbrev-ref --symbolic-full-name @{upstream}':
        'origin/main',
      'node --version': 'v24.0.0',
      'npm --version': '11.0.0',
    });

    await createService(executor, true, true).prepare();

    expect(executor.calls[0].args).toEqual([
      '-C', '/home/test/.aap-demo-podman-desktop-extension', 'remote', 'get-url', 'origin',
    ]);
    expect(executor.calls[1].args).toEqual([
      '-C', '/home/test/.aap-demo-podman-desktop-extension', 'rev-parse',
      '--abbrev-ref', '--symbolic-full-name', '@{upstream}',
    ]);
    expect(executor.calls[2].args).toEqual([
      '-C', '/home/test/.aap-demo-podman-desktop-extension', 'pull', '--ff-only', 'origin', 'refs/heads/main',
    ]);
  });

  it('refuses an official-origin checkout whose branch tracks another remote', async () => {
    const executor = new RecordingExecutor({
      'git -C /home/test/.aap-demo-podman-desktop-extension remote get-url origin':
        AAP_DEMO_EXTENSION_REPOSITORY_URL,
      'git -C /home/test/.aap-demo-podman-desktop-extension rev-parse --abbrev-ref --symbolic-full-name @{upstream}':
        'attacker/main',
    });

    await expect(createService(executor, true, true).prepare()).rejects.toThrow(
      'upstream is not the official origin remote',
    );
    expect(executor.calls).toHaveLength(2);
  });

  it('refuses an existing non-Git directory before running commands', async () => {
    const executor = new RecordingExecutor();

    await expect(createService(executor, true, false).prepare()).rejects.toThrow(/not a Git checkout/i);
    expect(executor.calls).toHaveLength(0);
  });

  it('gives an actionable error when Git is not installed', async () => {
    const executor = new RecordingExecutor(
      {},
      ['git', 'clone', AAP_DEMO_EXTENSION_REPOSITORY_URL, '/home/test/.aap-demo-podman-desktop-extension'].join(' '),
      'spawn git ENOENT',
    );

    await expect(createService(executor).prepare()).rejects.toThrow(
      'Git is required to set up or update the local extension',
    );
    expect(executor.calls).toHaveLength(1);
  });

  it('refuses to update a checkout with an untrusted origin', async () => {
    const executor = new RecordingExecutor({
      'git -C /home/test/.aap-demo-podman-desktop-extension remote get-url origin':
        'https://example.test/other/repository.git',
    });

    await expect(createService(executor, true, true).prepare()).rejects.toThrow(/official repository/i);
    expect(executor.calls).toHaveLength(1);
  });

  it('reports Node.js as missing and stops before npm commands', async () => {
    const executor = new RecordingExecutor({}, 'node --version');

    await expect(createService(executor, false, false, 'linux').prepare()).rejects.toMatchObject({
      name: 'MissingRuntimeError',
      runtime: 'node',
      reason: 'missing',
    } satisfies Partial<MissingRuntimeError>);
    expect(executor.calls.map(call => call.command)).toEqual(['git', 'node']);
  });

  it('reports outdated Node.js and stops before dependency installation', async () => {
    const executor = new RecordingExecutor({ 'node --version': 'v22.0.0' });

    await expect(createService(executor).prepare()).rejects.toMatchObject({
      runtime: 'node',
      reason: 'outdated',
      detectedVersion: 22,
    });
    expect(executor.calls.map(call => call.command)).toEqual(['git', 'node']);
  });

  it('reports npm as missing and stops before dependency installation', async () => {
    const executor = new RecordingExecutor(
      { 'node --version': 'v24.0.0' },
      'npm --version',
    );

    await expect(createService(executor, false, false, 'linux').prepare()).rejects.toMatchObject({
      runtime: 'npm',
      reason: 'missing',
    });
    expect(executor.calls.map(call => call.command)).toEqual(['git', 'node', 'npm']);
  });

  it('runs the Windows npm command file through the shell', async () => {
    const executor = new RecordingExecutor({
      'node --version': 'v24.0.0',
      'npm.cmd --version': '11.0.0',
    });

    await createService(executor, false, false, 'win32').prepare();

    const npmCalls = executor.calls.filter(call => call.command === 'npm.cmd');
    expect(npmCalls.map(call => call.args)).toEqual([['--version'], ['ci'], ['run', 'build']]);
    expect(npmCalls.every(call => call.options?.shell === true)).toBe(true);
  });
});
