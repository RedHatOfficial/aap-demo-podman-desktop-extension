import type { CommandExecutor } from './aap-demo-service';
import { resolveExecutablePath } from './executable-path';
import { forwardHostEnvironment } from './host-command';

export function shouldAutomaticallyInstallCli(options: {
  action: string;
  configuredPath: string;
  flatpakId?: string;
  installScriptAvailable: boolean;
  repairAlreadyAttempted: boolean;
}): boolean {
  return options.action === 'status'
    && options.configuredPath === 'aap-demo'
    && Boolean(options.flatpakId)
    && options.installScriptAvailable
    && !options.repairAlreadyAttempted;
}

export function missingCliMessage(configuredPath: string): string {
  return [
    `The aap-demo CLI could not be found at "${configuredPath}".`,
    'Open the AAP Demo dashboard and select Install aap-demo, or set aap-demo.cliPath to the installed executable.',
  ].join(' ');
}

export async function canInvokeCli(
  configuredPath: string,
  pathValue = process.env.PATH ?? '',
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  executor?: CommandExecutor,
): Promise<boolean> {
  if (platform !== 'win32' && environment.FLATPAK_ID) {
    const flatpakSpawn = resolveExecutablePath('flatpak-spawn', pathValue, { platform });
    if (!flatpakSpawn || !executor) return false;

    try {
      const hostArguments = forwardHostEnvironment(['--host'], { PATH: pathValue }, ['PATH']);
      await executor.run(flatpakSpawn, [
        ...hostArguments,
        'sh',
        '-c',
        'command -v "$1" >/dev/null 2>&1',
        'aap-demo-cli-check',
        configuredPath,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  return Boolean(resolveExecutablePath(configuredPath, pathValue));
}
