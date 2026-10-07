import type {
  CommandResult,
  CommandRunnerOptions,
} from './command-runner';
import { forwardHostEnvironment, resolveHostCommand } from './host-command';

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
    const optionsWithSettings = this.withSettings(
      options,
      action !== 'trust-ca' && action !== 'repair',
    );
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
    const optionsWithSettings = this.withSettings(options, true);
    const command = this.resolveCliCommand(optionsWithSettings?.env);
    const addonArgs = [action, addon];
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
          this.cliPath,
          ...addonArgs,
        ],
        { ...optionsWithSettings, env: environment, input: `${OPENAI_API_KEY}\n` },
      );
    }
    return this.executor.run(
      command.command,
      [...command.argsPrefix, ...addonArgs],
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
    const hostEnvironmentKeys = [
      'QUIET',
      'AAP_DEMO_TRUST_CA',
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
      'GALAXY_TOKEN_FILE',
    ];
    return forwardHostEnvironment(argsPrefix, env, hostEnvironmentKeys);
  }

  private withSettings(
    options?: CommandRunnerOptions,
    skipInteractiveTrustSetup = true,
  ): CommandRunnerOptions | undefined {
    const configuredEnvironment: NodeJS.ProcessEnv = {
      ...(options?.env ?? process.env),
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      QUIET: 'true',
    };
    if (skipInteractiveTrustSetup) {
      configuredEnvironment.AAP_DEMO_TRUST_CA = 'false';
    }
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
