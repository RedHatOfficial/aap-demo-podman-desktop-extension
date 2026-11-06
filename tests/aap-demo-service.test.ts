import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandResult, CommandRunnerOptions } from '../src/command-runner';
import { AapDemoService, type CommandExecutor } from '../src/aap-demo-service';

const temporaryRoots: string[] = [];
const linuxIt = process.platform === 'linux' ? it : it.skip;

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
  it('routes Python lifecycle actions to the Python CLI with noninteractive basic output', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, {
      legacy: '/opt/aap-demo-v1',
      python: '/home/test/.local/bin/aap-demo',
    });

    await service.run('deploy');

    expect(executor.calls[0]).toMatchObject({
      command: '/home/test/.local/bin/aap-demo',
      args: ['--output', 'basic', '--yes', 'deploy'],
    });
  });

  it('routes deferred lifecycle actions to the legacy CLI', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, {
      legacy: '/opt/aap-demo-v1',
      python: '/home/test/.local/bin/aap-demo',
    });

    await service.run('diagnose');

    expect(executor.calls[0]).toMatchObject({
      command: '/opt/aap-demo-v1',
      args: ['diagnose'],
    });
  });

  it('runs Python structured queries with JSON output', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, {
      legacy: '/opt/aap-demo-v1',
      python: '/home/test/.local/bin/aap-demo',
    });

    await service.runPythonQuery(['config', 'get', 'addons.enabled']);

    expect(executor.calls[0]).toMatchObject({
      command: '/home/test/.local/bin/aap-demo',
      args: ['--output', 'json', 'config', 'get', 'addons.enabled'],
    });
  });

  it('isolates Python commands from legacy-only environment variables', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, {
      legacy: '/opt/aap-demo-v1',
      python: '/home/test/.local/bin/aap-demo',
    });

    await service.run('deploy', undefined, {
      env: {
        QUIET: 'true',
        PULL_SECRET_PATH: '/legacy/pull-secret',
        REDHAT_SUBSCRIPTION_CREDENTIALS_FILE: '/legacy/credentials',
        AAP_DEMO_SKIP_CACHE: 'true',
      },
    });

    expect(executor.calls[0]?.options?.env).toEqual(expect.not.objectContaining({
      QUIET: expect.anything(),
      PULL_SECRET_PATH: expect.anything(),
      REDHAT_SUBSCRIPTION_CREDENTIALS_FILE: expect.anything(),
      AAP_DEMO_SKIP_CACHE: expect.anything(),
    }));
  });

  it('passes the resolved Python pull-secret path to deploy', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, '/home/test/.local/bin/aap-demo', {
      pythonPullSecretPath: '/home/test/.config/aap-demo/pull-secret.json',
    });

    await service.run('deploy');

    expect(executor.calls[0]?.options?.env?.AAP_DEMO_PULL_SECRET)
      .toBe('/home/test/.config/aap-demo/pull-secret.json');
  });

  it.each([
    ['create', ['--output', 'basic', '--yes', 'create']],
    ['start', ['--output', 'basic', '--yes', 'start']],
    ['deploy', ['--output', 'basic', '--yes', 'deploy']],
    ['stop', ['--output', 'basic', '--yes', 'stop']],
    ['destroy', ['--output', 'basic', '--yes', 'destroy']],
    ['status', ['--output', 'json', 'status']],
  ] as const)('runs the %s action through the Python CLI', async (action, args) => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, '/custom/bin/aap-demo');

    await service.run(action);

    expect(executor.calls[0]).toMatchObject({
      command: '/custom/bin/aap-demo',
      args,
    });
  });

  it.each([
    ['diagnose', ['diagnose']],
    ['trust-ca', ['trust-ca']],
  ] as const)('runs the deferred %s action through the legacy CLI', async (action, args) => {
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

  it('allows repair to use interactive CA trust setup', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor);

    await service.run('repair');

    expect(executor.calls[0]).toMatchObject({
      command: 'aap-demo',
      args: ['repair'],
    });
    expect(executor.calls[0].options?.env?.AAP_DEMO_TRUST_CA).not.toBe('false');
  });

  it('falls back to aap-demo when the configured CLI path is empty', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, '');

    await service.run('status');

    expect(executor.calls[0]).toMatchObject({
      command: 'aap-demo',
      args: ['--output', 'json', 'status'],
    });
  });

  it('resolves the CLI path for each command so a newly installed shim is used', async () => {
    const executor = new RecordingExecutor();
    let cliPath = '/old/profile/bin/aap-demo.cmd';
    const service = new AapDemoService(executor, () => cliPath);

    await service.run('status');
    cliPath = '/current/profile/bin/aap-demo.cmd';
    await service.run('status');

    expect(executor.calls.map(call => call.command)).toEqual([
      '/old/profile/bin/aap-demo.cmd',
      '/current/profile/bin/aap-demo.cmd',
    ]);
  });

  it('keeps deferred legacy actions quiet for Podman Desktop', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor);

    await service.run('idle');

    expect(executor.calls[0]?.options?.env?.QUIET).toBe('true');
  });

  it('skips interactive CA trust setup for silent actions but not Repair or Fix SSL', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor);

    await service.run('deploy');
    await service.run('repair');
    await service.run('trust-ca');

    expect(executor.calls[0]?.options?.env?.AAP_DEMO_TRUST_CA).toBe('false');
    expect(executor.calls[1]?.options?.env?.AAP_DEMO_TRUST_CA).toBeUndefined();
    expect(executor.calls[2]?.options?.env?.AAP_DEMO_TRUST_CA).toBeUndefined();
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
      AAP_DEMO_PULL_SECRET: '/tmp/pull-secret.txt',
      CRC_CPUS: '8',
      CRC_MEMORY: '24576',
      AAP_DEMO_TRUST_CA: 'false',
    });
  });

  it('passes the configured Red Hat subscription credentials file to the CLI', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, 'aap-demo', {
      subscriptionCredentialsFile: '/tmp/redhat-subscription-credentials',
    });

    await service.run('idle');

    expect(executor.calls[0]?.options?.env?.REDHAT_SUBSCRIPTION_CREDENTIALS_FILE)
      .toBe('/tmp/redhat-subscription-credentials');
  });

  it('skips the local image cache when requested by the host integration', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, 'aap-demo', { skipCache: true });

    await service.run('idle');

    expect(executor.calls[0]?.options?.env?.AAP_DEMO_SKIP_CACHE).toBe('true');
  });

  it('does not apply the image-cache bypass to read-only status checks', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, 'aap-demo', { skipCache: true });

    await service.run('status');

    expect(executor.calls[0]?.options?.env?.AAP_DEMO_SKIP_CACHE).toBeUndefined();
  });

  it('passes the augmented executable search path to the CLI', async () => {
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, 'aap-demo', {
      pathValue: '/usr/bin:/bin:/usr/local/bin',
    });

    await service.run('status');

    expect(executor.calls[0]?.options?.env?.PATH).toBe('/usr/bin:/bin:/usr/local/bin');
  });

  linuxIt('runs the CLI through the host when Podman Desktop is sandboxed as a Flatpak', async () => {
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
        '--env=AAP_DEMO_TRUST_CA=false',
        '--env=PYTHONIOENCODING=utf-8',
        '--env=PYTHONUTF8=1',
        '--env=PATH=' + directory,
        '--host',
        '/home/test/.local/bin/aap-demo',
        '--output',
        'basic',
        '--yes',
        'deploy',
      ],
      options: { env: expect.not.objectContaining({ QUIET: expect.anything() }) },
    });
  });

  linuxIt('resolves a bare CLI name through the host shell in Flatpak', async () => {
    const { directory, executable } = createExecutable('flatpak-spawn');
    const executor = new RecordingExecutor();
    const service = new AapDemoService(executor, 'aap-demo', {
      pathValue: directory,
      environment: { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' },
    });

    await service.run('status');

    expect(executor.calls[0]).toMatchObject({
      command: executable,
      args: [
        '--env=AAP_DEMO_TRUST_CA=false',
        '--env=PYTHONIOENCODING=utf-8',
        '--env=PYTHONUTF8=1',
        '--env=PATH=' + directory,
        '--host',
        '/bin/sh',
        '-c',
        'exec "$@"',
        'aap-demo-host-command',
        'aap-demo',
        '--output',
        'json',
        'status',
      ],
    });
  });

  linuxIt('forwards the selected AO provider through the Flatpak host bridge', async () => {
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

  linuxIt('passes the AO API key through standard input instead of process arguments', async () => {
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
