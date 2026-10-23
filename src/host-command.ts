import * as path from 'node:path';
import { resolveExecutablePath } from './executable-path';

export interface HostCommand {
  command: string;
  argsPrefix: string[];
}

export function forwardHostEnvironment(
  argsPrefix: string[],
  environment: NodeJS.ProcessEnv,
  keys: readonly string[],
): string[] {
  const hostIndex = argsPrefix.indexOf('--host');
  if (hostIndex < 0) return argsPrefix;

  const environmentArgs = keys.flatMap(key => {
    const value = environment[key];
    return value === undefined ? [] : [`--env=${key}=${value}`];
  });
  return [
    ...argsPrefix.slice(0, hostIndex),
    ...environmentArgs,
    ...argsPrefix.slice(hostIndex),
  ];
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
      // The portal resolves argv[0] before the forwarded PATH is applied. Use
      // a host shell for command names so user-installed executables resolve.
      return {
        command: flatpakSpawn,
        argsPrefix: path.isAbsolute(command)
          ? ['--host', command]
          : [
              '--host',
              '/bin/sh',
              '-c',
              'exec "$@"',
              'aap-demo-host-command',
              command,
            ],
      };
    }
  }

  return {
    command: resolveExecutablePath(command, pathValue, { platform }) ?? command,
    argsPrefix: [],
  };
}
