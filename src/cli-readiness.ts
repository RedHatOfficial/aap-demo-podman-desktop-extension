import { resolveExecutablePath } from './executable-path';

export function missingCliMessage(configuredPath: string): string {
  return [
    `The aap-demo CLI could not be found at "${configuredPath}".`,
    'Open the AAP Demo dashboard and select Install aap-demo, or set aap-demo.cliPath to the installed executable.',
  ].join(' ');
}

export function canInvokeCli(
  configuredPath: string,
  pathValue = process.env.PATH ?? '',
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform !== 'win32' && environment.FLATPAK_ID) {
    return Boolean(resolveExecutablePath('flatpak-spawn', pathValue));
  }

  return Boolean(resolveExecutablePath(configuredPath, pathValue));
}
