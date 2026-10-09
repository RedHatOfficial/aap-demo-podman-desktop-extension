import type {
  CommandResult,
  CommandRunnerOptions,
} from './command-runner';

export type AapDemoAction = 'create' | 'start' | 'deploy' | 'stop' | 'destroy' | 'status' | 'idle' | 'diagnose' | 'repair' | 'trust-ca';
export type AddonAction = 'enable' | 'disable';

export interface AapDemoSettings {
  cpus?: number;
  pullSecretPath?: string;
  memory?: number;
  pathValue?: string;
}

export interface CommandExecutor {
  run(
    command: string,
    args?: readonly string[],
    options?: CommandRunnerOptions,
  ): Promise<CommandResult>;
}

export type CliPathResolver = string | (() => string);

export class AapDemoService {
  private readonly cliPathResolver: () => string;

  constructor(
    private readonly executor: CommandExecutor,
    cliPath: CliPathResolver = 'aap-demo',
    private readonly settings: AapDemoSettings = {},
  ) {
    this.cliPathResolver = typeof cliPath === 'function'
      ? () => cliPath().trim() || 'aap-demo'
      : () => cliPath.trim() || 'aap-demo';
  }

  run(
    action: AapDemoAction,
    idleState?: boolean,
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    const args = action === 'idle'
      ? ['idle', String(idleState ?? true)]
      : [action];

    return this.executor.run(this.cliPathResolver(), args, this.withSettings(options));
  }

  runAddon(
    action: AddonAction,
    addon: string,
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    return this.executor.run(this.cliPathResolver(), [action, addon], this.withSettings(options));
  }

  private withSettings(options?: CommandRunnerOptions): CommandRunnerOptions | undefined {
    const configuredEnvironment: NodeJS.ProcessEnv = {
      ...(options?.env ?? process.env),
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      QUIET: 'true',
    };
    if (this.settings.pullSecretPath) {
      configuredEnvironment.PULL_SECRET_PATH = this.settings.pullSecretPath;
    }
    if (this.settings.cpus) {
      configuredEnvironment.CRC_CPUS = String(this.settings.cpus);
    }
    if (this.settings.memory) {
      configuredEnvironment.CRC_MEMORY = String(this.settings.memory);
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
