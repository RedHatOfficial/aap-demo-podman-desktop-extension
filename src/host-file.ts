import { chmodSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import type { CommandExecutor } from './aap-demo-service';
import { resolveHostCommand } from './host-command';

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
    mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    writeFileSync(filePath, contents, { encoding: 'utf8', mode: 0o600 });
    chmodSync(filePath, 0o600);
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
