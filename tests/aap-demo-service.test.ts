import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandResult, CommandRunnerOptions } from '../src/command-runner';
import { AapDemoService, type CommandExecutor } from '../src/aap-demo-service';

const temporaryRoots: string[] = [];

function createExecutable(name: string): { directory: string; executable: string } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-service-'));
  const executable = path.join(directory, name);
  writeFileSync(executable, '#!/bin/sh\n');
  chmodSync(executable, 0o755);
  temporaryRoots.push(directory);
  return { directory, executable };
}

class RecordingExecutor implements CommandExecutor {
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

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('AapDemoService', () => {
  it.each([
    ['create', ['create']],
    ['start', ['start']],
    ['deploy', ['deploy']],
    ['stop', ['stop']],
    ['destroy', ['destroy']],
    ['status', ['status']],
    ['diagnose', ['diagnose']],
    ['trust-ca', ['trust-ca']],
  ] as const)('runs the %s action through the configured CLI', async (action, args) => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, '/custom/bin/aap-demo');

    await service.run(action);

    expect(executor.calls[0]).toMatchObject({
      command: '/custom/bin/aap-demo',
      args,
      options: { env: { QUIET: 'true' } },
    });
  });

  it('passes the desired idle state to the CLI', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor);

    await service.run('idle', false);

    expect(executor.calls[0]).toMatchObject({
      command: 'aap-demo',
      args: ['idle', 'false'],
      options: { env: { QUIET: 'true' } },
    });
  });

  it('falls back to aap-demo when the configured CLI path is empty', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, '');

    await service.run('status');

    expect(executor.calls[0]).toMatchObject({
      command: 'aap-demo',
      args: ['status'],
      options: { env: { QUIET: 'true' } },
    });
  });

  it('always runs the CLI quietly for Podman Desktop', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor);

    await service.run('status');

    expect(executor.calls[0]?.options?.env?.QUIET).toBe('true');
  });

  it('skips interactive CA trust setup for silent actions but not Fix SSL', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor);

    await service.run('deploy');
    await service.run('trust-ca');

    expect(executor.calls[0]?.options?.env?.AAP_DEMO_TRUST_CA).toBe('false');
    expect(executor.calls[1]?.options?.env?.AAP_DEMO_TRUST_CA).toBeUndefined();
  });

  it('forces Python UTF-8 output for Windows provisioning helpers', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor);

    await service.runAddon('enable', 'ao');

    expect(executor.calls[0]?.options?.env).toMatchObject({
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    });
  });

  it('runs add-on enable and disable actions with the selected add-on', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor);

    await service.runAddon('enable', 'mcp-server');
    await service.runAddon('disable', 'mcp-server');

    expect(executor.calls[0]).toMatchObject({
      command: 'aap-demo',
      args: ['enable', 'mcp-server'],
      options: { env: { QUIET: 'true' } },
    });
    expect(executor.calls[1]).toMatchObject({
      command: 'aap-demo',
      args: ['disable', 'mcp-server'],
      options: { env: { QUIET: 'true' } },
    });
  });

  it('passes configured pull secret, CPU, and memory settings to the CLI', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, 'aap-demo', {
      pullSecretPath: '/tmp/pull-secret.txt',
      cpus: 8,
      memory: 24576,
    });

    await service.run('create');

    expect(executor.calls[0]?.options?.env).toMatchObject({
      PULL_SECRET_PATH: '/tmp/pull-secret.txt',
      CRC_CPUS: '8',
      CRC_MEMORY: '24576',
    });
  });

  it('passes the augmented executable search path to the CLI', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, 'aap-demo', {
      pathValue: '/usr/bin:/bin:/usr/local/bin',
    });

    await service.run('status');

    expect(executor.calls[0]?.options?.env?.PATH).toBe('/usr/bin:/bin:/usr/local/bin');
  });

  it('runs the CLI through the host when Podman Desktop is sandboxed as a Flatpak', async () => {
    const { directory, executable } = createExecutable('flatpak-spawn');
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, '/home/test/.local/bin/aap-demo', {
      pathValue: directory,
      environment: { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
    });

    await service.run('deploy');

    expect(executor.calls[0]).toMatchObject({
      command: executable,
      args: [
        '--env=QUIET=true',
        '--env=AAP_DEMO_TRUST_CA=false',
        '--env=PYTHONIOENCODING=utf-8',
        '--env=PYTHONUTF8=1',
        '--env=PATH=' + directory,
        '--host',
        '/home/test/.local/bin/aap-demo',
        'deploy',
      ],
      options: { env: expect.objectContaining({ QUIET: 'true' }) },
    });
  });

  it('forwards the selected AO provider through the Flatpak host bridge', async () => {
    const { directory, executable } = createExecutable('flatpak-spawn');
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, '/home/test/.local/bin/aap-demo', {
      pathValue: directory,
      environment: { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
    });

    await service.runAddon('enable', 'ao', {
      env: {
        AO_LLM_PROVIDER: 'external',
        AO_LLM_MODEL: 'gpt-5.6-luna',
        AO_LLM_BASE_URL: 'https://api.openai.com/v1',
        AO_LLM_API_KEY_FILE: '/home/test/.aap-demo/ao/llm-api-key',
      },
    });

    expect(executor.calls[0]).toMatchObject({
      command: executable,
      args: expect.arrayContaining([
        '--env=AO_LLM_PROVIDER=external',
        '--env=AO_LLM_MODEL=gpt-5.6-luna',
        '--env=AO_LLM_BASE_URL=https://api.openai.com/v1',
        '--env=AO_LLM_API_KEY_FILE=/home/test/.aap-demo/ao/llm-api-key',
      ]),
    });
  });

  it('passes the AO API key through standard input instead of process arguments', async () => {
    const { directory, executable } = createExecutable('flatpak-spawn');
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, '/home/test/.local/bin/aap-demo', {
      pathValue: directory,
      environment: { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
    });

    await service.runAddon('enable', 'ao', {
      env: {
        OPENAI_API_KEY: 'secret-api-key',
      },
    });

    expect(executor.calls[0]).toMatchObject({
      command: executable,
      args: [
        '--env=QUIET=true',
        '--env=AAP_DEMO_TRUST_CA=false',
        '--env=PYTHONIOENCODING=utf-8',
        '--env=PYTHONUTF8=1',
        '--env=PATH=' + directory,
        '--host',
        '/bin/sh',
        '-c',
        'IFS= read -r OPENAI_API_KEY; export OPENAI_API_KEY; shift; exec "$@"',
        'aap-demo-openai-key',
        '/home/test/.local/bin/aap-demo',
        'enable',
        'ao',
      ],
      options: {
        input: 'secret-api-key\n',
        env: expect.not.objectContaining({ OPENAI_API_KEY: expect.anything() }),
      },
    });
    expect(executor.calls[0]?.args.join(' ')).not.toContain('secret-api-key');
  });
});
