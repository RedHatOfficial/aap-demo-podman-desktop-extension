import type { CommandExecutor } from './aap-demo-service';
import { resolveHostCommand } from './host-command';

export async function hasHostOpenAiKey(
  executor: CommandExecutor,
  keyFile: string,
  pathValue: string | undefined,
  environment: NodeJS.ProcessEnv,
): Promise<boolean> {
  if (!environment.FLATPAK_ID) return false;

  const command = resolveHostCommand('/usr/bin/test', pathValue, environment);
  try {
    await executor.run(command.command, [...command.argsPrefix, '-s', keyFile]);
    return true;
  } catch {
    return false;
  }
}
