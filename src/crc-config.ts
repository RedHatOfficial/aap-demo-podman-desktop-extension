import type { CommandRunnerOptions, CommandResult } from './command-runner';
import { forwardHostEnvironment, resolveHostCommand } from './host-command';

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
  if (settings.environment?.FLATPAK_ID && !command.argsPrefix.includes('--host')) {
    throw new Error('Cannot configure CRC from Flatpak: flatpak-spawn is unavailable.');
  }
  const commandArgsPrefix = forwardHostEnvironment(command.argsPrefix, environment, ['PATH']);

  for (const [setting, value] of [
    ['cpus', settings.cpus],
    ['memory', settings.memory],
  ] as const) {
    if (value === undefined) continue;
    await executor.run(
      command.command,
      [...commandArgsPrefix, 'config', 'set', setting, String(value)],
      { env: environment },
    );
  }
}
