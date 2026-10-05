import { accessSync, constants, statSync } from 'node:fs';
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
  return expandHome(configured || '~/.aap-demo');
}

export function installScriptPathFor(installLocation: string): string {
  return path.join(resolveInstallLocation(installLocation), 'install.sh');
}
