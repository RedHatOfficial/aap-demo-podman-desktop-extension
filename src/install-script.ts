import { accessSync, constants, existsSync, readdirSync, statSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const AAP_DEMO_REPOSITORY_URL = 'https://github.com/RedHatOfficial/aap-demo.git';

function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function isReadableFile(candidate: string): boolean {
  try {
    accessSync(candidate, constants.R_OK);
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

export function resolveInstallScriptPath(configuredPath = ''): string | undefined {
  const candidate = installScriptPathFor(configuredPath);
  return isReadableFile(candidate) ? candidate : undefined;
}

export function resolveInstallLocation(configuredPath = ''): string {
  const configured = configuredPath.trim();
  return expandHome(configured || '~/.aap-demo/aap-demo');
}

function isAapDemoSource(location: string): boolean {
  return isReadableFile(path.join(location, 'install.sh'))
    && isReadableFile(path.join(location, 'aap-demo.sh'));
}

/**
 * Resolve the repository directory, keeping an already-populated data directory intact.
 * When the configured directory is occupied by non-repository files, use its aap-demo child.
 */
export function resolveAapDemoSourceLocation(configuredPath = ''): string {
  const location = resolveInstallLocation(configuredPath);
  if (!existsSync(location)) return location;

  if (isAapDemoSource(location)) {
    return location;
  }

  if (!statSync(location).isDirectory()) return location;

  const nestedLocation = path.join(location, 'aap-demo');
  if (isAapDemoSource(nestedLocation)) {
    return nestedLocation;
  }

  if (existsSync(path.join(location, '.git'))) return location;
  if (existsSync(path.join(nestedLocation, '.git'))) return nestedLocation;

  return readdirSync(location).length > 0 ? nestedLocation : location;
}

export function installScriptPathFor(installLocation: string): string {
  return path.join(resolveAapDemoSourceLocation(installLocation), 'install.sh');
}

/** Git for Windows Bash accepts native Windows paths; keep the drive visible. */
export function resolveBashScriptPath(
  scriptPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform !== 'win32') return scriptPath;
  return scriptPath.replaceAll('\\', '/');
}

export function bashScriptInvocation(
  scriptPath: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  const bashPath = resolveBashScriptPath(scriptPath, platform);
  return [bashPath];
}

export function installToolHint(
  command: string,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  if (platform === 'win32' && (command === 'bash' || command === 'git')) {
    return 'Git for Windows is required to install aap-demo because it provides Git and Bash. Install it from https://git-scm.com/download/win or run `winget install --id Git.Git -e`, then restart Podman Desktop and try again.';
  }
  return undefined;
}
