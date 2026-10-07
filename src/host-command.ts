import { resolveExecutablePath } from './executable-path';

export interface HostCommand {
  command: string;
  argsPrefix: string[];
}

export function resolveHostCommand(
  command: string,
  pathValue = process.env.PATH ?? '',
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): HostCommand {
  if (platform !== 'win32' && environment.FLATPAK_ID) {
    const flatpakSpawn = resolveExecutablePath('flatpak-spawn', pathValue);
    if (flatpakSpawn) {
      return { command: flatpakSpawn, argsPrefix: ['--host', command] };
    }
  }

  return {
    command: resolveExecutablePath(command, pathValue, { platform }) ?? command,
    argsPrefix: [],
  };
}
