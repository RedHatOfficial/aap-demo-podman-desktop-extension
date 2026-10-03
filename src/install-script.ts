import { accessSync, constants, statSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

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
  const configured = configuredPath.trim();
  const candidates = configured
    ? [expandHome(configured)]
    : [
        path.join(os.homedir(), 'Documents', 'GitHub', 'aap-demo', 'install.sh'),
        path.join(os.homedir(), 'Projects', 'aap-demo', 'install.sh'),
        path.join(os.homedir(), 'aap-demo', 'install.sh'),
      ];

  return candidates.find(isReadableFile);
}
