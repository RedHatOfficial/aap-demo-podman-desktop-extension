import type {
  CommandResult,
  CommandRunnerOptions,
} from './command-runner';
import { resolveHostCommand } from './host-command';

export type AapDemoAction = 'create' | 'start' | 'deploy' | 'stop' | 'destroy' | 'status' | 'idle' | 'diagnose' | 'repair' | 'trust-ca';
export type AddonAction = 'enable' | 'disable';

export interface AapDemoSettings {
  cpus?: number;
  environment?: NodeJS.ProcessEnv;
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

export class AapDemoService {
  private readonly cliPath: string;

  constructor(
    private readonly executor: CommandExecutor,
    cliPath = 'aap-demo',
    private readonly settings: AapDemoSettings = {},
  ) {
    this.cliPath = cliPath.trim() || 'aap-demo';
  }

  run(
    action: AapDemoAction,
    idleState?: boolean,
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    const args = action === 'idle'
      ? ['idle', String(idleState ?? true)]
      : [action];
    const optionsWithSettings = this.withSettings(options);
    const command = this.resolveCliCommand(optionsWithSettings?.env);

    return this.executor.run(
      command.command,
      [...command.argsPrefix, ...args],
      optionsWithSettings,
    );
  }

  runAddon(
    action: AddonAction,
    addon: string,
    options?: CommandRunnerOptions,
  ): Promise<CommandResult> {
    const optionsWithSettings = this.withSettings(options);
    const command = this.resolveCliCommand(optionsWithSettings?.env);
    return this.executor.run(
      command.command,
      [...command.argsPrefix, action, addon],
      optionsWithSettings,
    );
  }

  private resolveCliCommand(env?: NodeJS.ProcessEnv): ReturnType<typeof resolveHostCommand> {
    const environment = this.settings.environment ?? process.env;
    if (!environment.FLATPAK_ID) {
      return { command: this.cliPath, argsPrefix: [] };
    }

    const command = resolveHostCommand(
      this.cliPath,
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
    if (argsPrefix[0] !== '--host') return argsPrefix;
    const hostEnvironmentKeys = [
      'QUIET',
      'PYTHONIOENCODING',
      'PYTHONUTF8',
      'PULL_SECRET_PATH',
      'CRC_CPUS',
      'CRC_MEMORY',
      'PATH',
      'AO_LLM_PROVIDER',
      'AO_LLM_MODEL',
      'AO_LLM_BASE_URL',
      'AO_LLM_API_KEY_FILE',
      'OPENAI_API_KEY',
      'GALAXY_TOKEN_FILE',
    ];
    const hostEnvironmentArgs = hostEnvironmentKeys
      .flatMap(key => {
        const value = env[key];
        return value === undefined ? [] : [`--env=${key}=${value}`];
      });

    return [...hostEnvironmentArgs, '--host', ...argsPrefix.slice(1)];
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
