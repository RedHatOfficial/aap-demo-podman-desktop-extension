import type { CommandRunnerOptions, CommandResult } from './command-runner';
import { resolveHostCommand } from './host-command';

export interface CrcCommandExecutor {
  run(
    command: string,
    args?: readonly string[],
    options?: CommandRunnerOptions,
  ): Promise<CommandResult>;
}

export interface CrcResourceSettings {
  cpus?: number;
  environment?: NodeJS.ProcessEnv;
  memory?: number;
  pathValue?: string;
}

export async function applyCrcResourceSettings(
  executor: CrcCommandExecutor,
  crcPath: string,
  settings: CrcResourceSettings,
): Promise<void> {
  const environment = {
    ...(settings.environment ?? process.env),
    ...(settings.pathValue ? { PATH: settings.pathValue } : {}),
    QUIET: 'true',
  };
  const command = resolveHostCommand(
    crcPath,
    settings.pathValue,
    settings.environment ?? process.env,
  );

  for (const [setting, value] of [
    ['cpus', settings.cpus],
    ['memory', settings.memory],
  ] as const) {
    if (value === undefined) continue;
    await executor.run(
      command.command,
      [...command.argsPrefix, 'config', 'set', setting, String(value)],
      { env: environment },
    );
  }
}
