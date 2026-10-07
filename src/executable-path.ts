import { accessSync, constants, readdirSync, statSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ResolveExecutablePathOptions {
  pathExt?: string;
  platform?: NodeJS.Platform;
}

function isExecutable(candidate: string): boolean {
  try {
    accessSync(candidate, constants.X_OK);
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function expandHome(command: string): string {
  if (command === '~') return os.homedir();
  if (command.startsWith('~/') || command.startsWith('~\\')) {
    return path.join(os.homedir(), command.slice(2));
  }
  return command;
}

export function crcCacheExecutableDirectories(homeDirectory = os.homedir()): string[] {
  const cacheDirectory = path.join(homeDirectory, '.crc', 'cache');
  try {
    return readdirSync(cacheDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(cacheDirectory, entry.name))
      .filter(directory => isExecutable(path.join(directory, 'oc')));
  } catch {
    return [];
  }
}

function fallbackDirectories(): string[] {
  return [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    path.join(os.homedir(), '.crc', 'bin'),
    ...crcCacheExecutableDirectories(),
    path.join(os.homedir(), '.local', 'bin'),
  ];
}

function windowsExecutableExtensions(pathExt = process.env.PATHEXT ?? ''): string[] {
  const configured = pathExt
    .split(';')
    .map(extension => extension.trim().toLowerCase())
    .filter(Boolean);
  return configured.length > 0 ? configured : ['.com', '.exe', '.bat', '.cmd'];
}

function executableCandidates(
  command: string,
  options: ResolveExecutablePathOptions = {},
): string[] {
  if ((options.platform ?? process.platform) !== 'win32') return [command];
  if (path.extname(command)) return [command];

  return [
    command,
    ...windowsExecutableExtensions(options.pathExt).map(extension => `${command}${extension}`),
  ];
}

export function augmentPath(pathValue = process.env.PATH ?? ''): string {
  return [...new Set([...pathValue.split(path.delimiter), ...fallbackDirectories()])]
    .filter(Boolean)
    .join(path.delimiter);
}

export function resolveExecutablePath(
  command: string,
  pathValue = process.env.PATH ?? '',
  options: ResolveExecutablePathOptions = {},
): string | undefined {
  const expandedCommand = expandHome(command);
  if (path.isAbsolute(expandedCommand)) {
    return executableCandidates(expandedCommand, options).find(isExecutable);
  }

  const directories = augmentPath(pathValue).split(path.delimiter);

  for (const directory of directories) {
    if (!directory) continue;
    for (const commandCandidate of executableCandidates(expandedCommand, options)) {
      const candidate = path.join(directory, commandCandidate);
      if (isExecutable(candidate)) return candidate;
    }
  }

  return undefined;
}

export function resolveConfiguredExecutable(
  command: string,
  pathValue = process.env.PATH ?? '',
  options: ResolveExecutablePathOptions = {},
): string {
  const expandedCommand = expandHome(command);
  return resolveExecutablePath(expandedCommand, pathValue, options) ?? expandedCommand;
}
