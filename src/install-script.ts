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

  if (existsSync(path.join(location, '.git')) || isAapDemoSource(location)) {
    return location;
  }

  if (!statSync(location).isDirectory()) return location;

  const nestedLocation = path.join(location, 'aap-demo');
  if (existsSync(path.join(nestedLocation, '.git')) || isAapDemoSource(nestedLocation)) {
    return nestedLocation;
  }

  return readdirSync(location).length > 0 ? nestedLocation : location;
}

export function installScriptPathFor(installLocation: string): string {
  return path.join(resolveAapDemoSourceLocation(installLocation), 'install.sh');
}

/** Bash treats Windows backslashes as escapes, so pass Windows paths with `/`. */
export function resolveBashScriptPath(
  scriptPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === 'win32' ? scriptPath.replaceAll('\\', '/') : scriptPath;
}

export function bashScriptInvocation(
  scriptPath: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  const bashPath = resolveBashScriptPath(scriptPath, platform);
  if (platform !== 'win32') return [bashPath];

  return [
    '-lc',
    'if command -v cygpath >/dev/null 2>&1; then script=$(cygpath -u "$1"); else script="$1"; fi; exec bash "$script"',
    '--',
    bashPath,
  ];
}
