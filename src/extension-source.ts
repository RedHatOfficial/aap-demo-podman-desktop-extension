import * as os from 'node:os';
import * as path from 'node:path';

export const DEFAULT_EXTENSION_INSTALL_LOCATION = '~/.aap-demo-podman-desktop-extension';

export function resolveExtensionInstallLocation(
  configuredPath: string,
  homeDirectory = os.homedir(),
): string {
  const value = configuredPath.trim() || DEFAULT_EXTENSION_INSTALL_LOCATION;
  if (value === '~') return homeDirectory;
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(homeDirectory, value.slice(2));
  }
  return value;
}

export function getExtensionCheckoutAction(
  targetExists: boolean,
  gitMetadataExists: boolean,
): 'clone' | 'update' | 'refuse' {
  if (!targetExists) return 'clone';
  return gitMetadataExists ? 'update' : 'refuse';
}

export function parseNodeMajorVersion(output: string): number | undefined {
  const match = output.trim().match(/^v?([0-9]+)\./);
  return match ? Number(match[1]) : undefined;
}
