import { chmodSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type { CommandExecutor } from './aap-demo-service';
import { resolveHostCommand } from './host-command';

export function windowsFileAclArgs(filePath: string, username: string): string[] {
  return [filePath, '/inheritance:r', '/grant:r', `${username}:F`];
}

export async function hasHostFile(
  executor: CommandExecutor,
  filePath: string,
  pathValue: string | undefined,
  environment: NodeJS.ProcessEnv,
): Promise<boolean> {
  if (!environment.FLATPAK_ID) {
    try {
      const stats = lstatSync(filePath);
      return stats.isFile() && !stats.isSymbolicLink() && stats.size > 0;
    } catch {
      return false;
    }
  }

  const command = resolveHostCommand('/bin/sh', pathValue, environment);
  if (!command.argsPrefix.includes('--host')) return false;
  try {
    await executor.run(command.command, [
      ...command.argsPrefix,
      '-c',
      'test -f "$1" && test ! -L "$1" && test -s "$1"',
      'aap-demo-token',
      filePath,
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function readHostFile(
  executor: CommandExecutor,
  filePath: string,
  pathValue: string | undefined,
  environment: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  if (!environment.FLATPAK_ID) {
    try {
      const stats = lstatSync(filePath);
      if (!stats.isFile() || stats.isSymbolicLink() || stats.size === 0) return undefined;
      return readFileSync(filePath, 'utf8');
    } catch {
      return undefined;
    }
  }

  const command = resolveHostCommand('/bin/sh', pathValue, environment);
  if (!command.argsPrefix.includes('--host')) return undefined;
  try {
    const result = await executor.run(command.command, [
      ...command.argsPrefix,
      '-c',
      'test -f "$1" && test ! -L "$1" && test -s "$1" && cat -- "$1"',
      'aap-demo-token',
      filePath,
    ]);
    return result.stdout || undefined;
  } catch {
    return undefined;
  }
}

export async function saveHostFile(
  executor: CommandExecutor,
  filePath: string,
  pathValue: string | undefined,
  environment: NodeJS.ProcessEnv,
  contents: string,
): Promise<void> {
  if (!environment.FLATPAK_ID) {
    const existing = (() => {
      try {
        return lstatSync(filePath);
      } catch {
        return undefined;
      }
    })();
    if (existing?.isSymbolicLink()) throw new Error(`Refusing to write through symbolic link: ${filePath}`);
    const directory = path.dirname(filePath);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = path.join(directory, `.aap-demo-token.${randomUUID()}`);
    try {
      writeFileSync(temporaryPath, contents, { encoding: 'utf8', mode: 0o600 });
      chmodSync(temporaryPath, 0o600);
      if (process.platform === 'win32') {
        const username = environment.USERNAME?.trim();
        if (!username) throw new Error('Cannot secure the credential file: Windows username is unavailable.');
        const icacls = resolveHostCommand('icacls', pathValue, environment, 'win32');
        await executor.run(icacls.command, [
          ...icacls.argsPrefix,
          ...windowsFileAclArgs(temporaryPath, username),
        ]);
      }
      renameSync(temporaryPath, filePath);
    } finally {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // The temporary file was renamed successfully or was never created.
      }
    }
    return;
  }

  const command = resolveHostCommand('/bin/sh', pathValue, environment);
  if (!command.argsPrefix.includes('--host')) {
    throw new Error('Cannot access the host filesystem from Flatpak: flatpak-spawn is unavailable.');
  }
  await executor.run(
    command.command,
    [
      ...command.argsPrefix,
      '-c',
      "set -eu; umask 077; mkdir -p \"$1\"; tmp=$(mktemp \"$1/.aap-demo-token.XXXXXX\"); trap 'rm -f \"$tmp\"' EXIT; chmod 600 \"$tmp\"; cat > \"$tmp\"; mv -f \"$tmp\" \"$1/$2\"; trap - EXIT",
      'aap-demo-token',
      path.dirname(filePath),
      path.basename(filePath),
    ],
    { input: contents },
  );
}
