import type {
  CommandResult,
  CommandRunnerOptions,
} from './command-runner';
import { forwardHostEnvironment, resolveHostCommand } from './host-command';

export type AapDemoAction = 'create' | 'start' | 'deploy' | 'stop' | 'destroy' | 'status' | 'idle' | 'diagnose' | 'repair' | 'trust-ca';
export type AddonAction = 'enable' | 'disable';
export type AapDemoBackend = 'legacy' | 'python';

const CACHE_BYPASS_ACTIONS = new Set<AapDemoAction>([
  'create',
  'start',
  'deploy',
  'stop',
  'destroy',
  'idle',
]);

export interface AapDemoSettings {
  cpus?: number;
  environment?: NodeJS.ProcessEnv;
  pullSecretPath?: string;
  skipCache?: boolean;
  memory?: number;
  pathValue?: string;
  subscriptionCredentialsFile?: string;
}

export interface CommandExecutor {
  run(
    command: string,
    args?: readonly string[],
    options?: CommandRunnerOptions,
  ): Promise<CommandResult>;
}

export type CliPathResolver = string | (() => string);

export interface AapDemoCliPaths {
  legacy: CliPathResolver;
  python: CliPathResolver;
}

const PYTHON_ACTIONS = new Set<AapDemoAction>([
  'create',
  'start',
  'deploy',
  'stop',
  'destroy',
  'status',
]);

const PYTHON_ADDONS = new Set(['fleet']);

function createCliPathResolver(pathValue: CliPathResolver): () => string {
  return typeof pathValue === 'function'
    ? () => pathValue().trim() || 'aap-demo'
    : () => pathValue.trim() || 'aap-demo';
}

export class AapDemoService {
  private readonly cliPathResolvers: Record<AapDemoBackend, () => string>;

  constructor(
    private readonly executor: CommandExecutor,
    cliPath: CliPathResolver | AapDemoCliPaths = 'aap-demo',
    private readonly settings: AapDemoSettings = {},
  ) {
    const paths: AapDemoCliPaths = typeof cliPath === 'object'
      ? cliPath
      : { legacy: cliPath, python: cliPath };
    this.cliPathResolvers = {
      legacy: createCliPathResolver(paths.legacy),
      python: createCliPathResolver(paths.python),
    };
  }

  run(
    action: AapDemoAction,
    idleState?: boolean,
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    const backend = PYTHON_ACTIONS.has(action) ? 'python' : 'legacy';
    return this.runWithBackend(backend, action, idleState, options);
  }

  runWithBackend(
    backend: AapDemoBackend,
    action: AapDemoAction,
    idleState?: boolean,
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    const args = action === 'idle'
      ? ['idle', String(idleState ?? true)]
      : [action];
    const optionsWithSettings = this.withSettings(
      options,
      backend,
      action !== 'trust-ca' && action !== 'repair',
      CACHE_BYPASS_ACTIONS.has(action),
    );
    const command = this.resolveCliCommand(backend, optionsWithSettings?.env);
    const outputPrefix = backend === 'python'
      ? action === 'status'
        ? ['--output', 'json']
        : ['--output', 'basic', '--yes']
      : [];

    return this.executor.run(
      command.command,
      [...command.argsPrefix, ...outputPrefix, ...args],
      optionsWithSettings,
    );
  }

  runPythonQuery(
    args: readonly string[],
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    const optionsWithSettings = this.withSettings(options, 'python', true, false, false);
    const command = this.resolveCliCommand('python', optionsWithSettings?.env);
    return this.executor.run(
      command.command,
      [...command.argsPrefix, '--output', 'json', ...args],
      optionsWithSettings,
    );
  }

  runAddon(
    action: AddonAction,
    addon: string,
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    const backend: AapDemoBackend = PYTHON_ADDONS.has(addon) ? 'python' : 'legacy';
    const optionsWithSettings = this.withSettings(options, backend, true, backend === 'legacy');
    const command = this.resolveCliCommand(backend, optionsWithSettings?.env);
    const addonArgs = [action, addon];
    const outputPrefix = backend === 'python' ? ['--output', 'basic', '--yes'] : [];
    if (command.argsPrefix.includes('--host') && optionsWithSettings?.env?.OPENAI_API_KEY) {
      const { OPENAI_API_KEY, ...environment } = optionsWithSettings.env;
      const hostIndex = command.argsPrefix.indexOf('--host');
      return this.executor.run(
        command.command,
        [
          ...command.argsPrefix.slice(0, hostIndex),
          '--host',
          '/bin/sh',
          '-c',
          'IFS= read -r OPENAI_API_KEY; export OPENAI_API_KEY; shift; exec "$@"',
          'aap-demo-openai-key',
          this.cliPathResolvers[backend](),
          ...outputPrefix,
          ...addonArgs,
        ],
        { ...optionsWithSettings, env: environment, input: `${OPENAI_API_KEY}\n` },
      );
    }
    return this.executor.run(
      command.command,
      [...command.argsPrefix, ...outputPrefix, ...addonArgs],
      optionsWithSettings,
    );
  }

  private resolveCliCommand(
    backend: AapDemoBackend,
    env?: NodeJS.ProcessEnv,
  ): ReturnType<typeof resolveHostCommand> {
    const cliPath = this.cliPathResolvers[backend]();
    const environment = this.settings.environment ?? process.env;
    if (!environment.FLATPAK_ID) {
      return { command: cliPath, argsPrefix: [] };
    }

    const command = resolveHostCommand(
      cliPath,
      this.settings.pathValue,
      environment,
    );
    return {
      command: command.command,
      argsPrefix: this.withFlatpakHostEnvironment(command.argsPrefix, env),
    };
  }

  private withFlatpakHostEnvironment(
    argsPrefix: string[],
    env: NodeJS.ProcessEnv = {},
  ): string[] {
    const hostEnvironmentKeys = [
      'QUIET',
      'AAP_DEMO_TRUST_CA',
      'PYTHONIOENCODING',
      'PYTHONUTF8',
      'PULL_SECRET_PATH',
      'AAP_DEMO_PULL_SECRET',
      'REDHAT_SUBSCRIPTION_CREDENTIALS_FILE',
      'CRC_CPUS',
      'CRC_MEMORY',
      'AAP_DEMO_SKIP_CACHE',
      'PATH',
      'AO_LLM_PROVIDER',
      'AO_LLM_MODEL',
      'AO_LLM_BASE_URL',
      'AO_LLM_API_KEY_FILE',
      'GALAXY_TOKEN_FILE',
    ];
    return forwardHostEnvironment(argsPrefix, env, hostEnvironmentKeys);
  }

  private withSettings(
    options?: CommandRunnerOptions,
    backend: AapDemoBackend = 'legacy',
    skipInteractiveTrustSetup = true,
    skipCache = false,
    quiet = backend === 'legacy',
  ): CommandRunnerOptions | undefined {
    const configuredEnvironment: NodeJS.ProcessEnv = {
      ...(options?.env ?? process.env),
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };
    if (quiet) configuredEnvironment.QUIET = 'true';
    if (skipInteractiveTrustSetup) {
      configuredEnvironment.AAP_DEMO_TRUST_CA = 'false';
    }
    if (this.settings.pullSecretPath) {
      configuredEnvironment[backend === 'python' ? 'AAP_DEMO_PULL_SECRET' : 'PULL_SECRET_PATH'] = this.settings.pullSecretPath;
    }
    if (backend === 'legacy' && this.settings.subscriptionCredentialsFile) {
      configuredEnvironment.REDHAT_SUBSCRIPTION_CREDENTIALS_FILE = this.settings.subscriptionCredentialsFile;
    }
    if (this.settings.cpus) {
      configuredEnvironment.CRC_CPUS = String(this.settings.cpus);
    }
    if (this.settings.memory) {
      configuredEnvironment.CRC_MEMORY = String(this.settings.memory);
    }
    if (backend === 'legacy' && this.settings.skipCache && skipCache) {
      configuredEnvironment.AAP_DEMO_SKIP_CACHE = 'true';
    }
    if (this.settings.pathValue) {
      configuredEnvironment.PATH = this.settings.pathValue;
    }

    return {
      ...options,
      env: configuredEnvironment,
    };
  }
}
