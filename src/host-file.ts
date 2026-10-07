import { lstatSync } from 'node:fs';
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
