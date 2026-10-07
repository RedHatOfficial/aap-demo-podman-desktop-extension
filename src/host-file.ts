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

  const command = resolveHostCommand('/usr/bin/test', pathValue, environment);
  try {
    await executor.run(command.command, [...command.argsPrefix, '-s', filePath]);
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
  await executor.run(
    command.command,
    [
      ...command.argsPrefix,
      '-c',
      'umask 077; mkdir -p "$1"; cat > "$1/$2"; chmod 600 "$1/$2"',
      'aap-demo-token',
      path.dirname(filePath),
      path.basename(filePath),
    ],
    { input: contents },
  );
}
