import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as os from 'node:os';
import { resolveExecutablePath } from './executable-path';

export type RuntimePackageManager = 'dnf' | 'yum' | 'brew' | 'winget';

export interface RuntimeInstallPlan {
  status: 'ready';
  packageManager: RuntimePackageManager;
  command: string;
  args: string[];
}

export type RuntimeInstallResolution = RuntimeInstallPlan
  | { status: 'package-manager-missing'; packageManager: RuntimePackageManager }
  | { status: 'unsupported-platform' };

export interface TerminalLaunchSpec {
  command: string;
  args: string[];
}

export interface RuntimeTerminalLauncher {
  launch(spec: TerminalLaunchSpec): Promise<void>;
}

type ExecutableLookup = (name: string) => string | undefined;

function parseOsRelease(osRelease: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of osRelease.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    values.set(match[1], value);
  }
  return values;
}

function isRhelFamily(osRelease: string): boolean {
  const values = parseOsRelease(osRelease);
  const identities = [values.get('ID') ?? '', ...(values.get('ID_LIKE') ?? '').split(/\s+/)]
    .map(identity => identity.toLowerCase());
  return identities.some(identity => [
    'rhel', 'redhat', 'centos', 'rocky', 'almalinux', 'ol', 'oracle', 'fedora', 'amzn',
  ].includes(identity));
}

function availableManager(
  names: RuntimePackageManager[],
  executableLookup: ExecutableLookup,
): RuntimeInstallResolution {
  for (const packageManager of names) {
    const command = executableLookup(packageManager);
    if (!command) continue;
    if (packageManager === 'dnf' || packageManager === 'yum') {
      return { status: 'ready', packageManager, command, args: ['install', 'nodejs', 'npm'] };
    }
    if (packageManager === 'brew') {
      return { status: 'ready', packageManager, command, args: ['install', 'node'] };
    }
    return {
      status: 'ready',
      packageManager,
      command,
      args: ['install', '--id', 'OpenJS.NodeJS.LTS', '--exact', '--interactive'],
    };
  }
  return { status: 'package-manager-missing', packageManager: names[0] };
}

export function resolveRuntimeInstallPlan(
  platform: NodeJS.Platform,
  osRelease: string,
  executableLookup: ExecutableLookup,
): RuntimeInstallResolution {
  if (platform === 'darwin') return availableManager(['brew'], executableLookup);
  if (platform === 'win32') {
    const command = executableLookup('winget.exe') ?? executableLookup('winget');
    return command
      ? {
          status: 'ready',
          packageManager: 'winget',
          command,
          args: ['install', '--id', 'OpenJS.NodeJS.LTS', '--exact', '--interactive'],
        }
      : { status: 'package-manager-missing', packageManager: 'winget' };
  }
  if (platform === 'linux' && isRhelFamily(osRelease)) {
    return availableManager(['dnf', 'yum'], executableLookup);
  }
  return { status: 'unsupported-platform' };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function appleScriptQuote(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function powershellQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function commandLine(plan: RuntimeInstallPlan): string {
  const args = [plan.command, ...plan.args].map(shellQuote).join(' ');
  const privileged = plan.packageManager === 'dnf' || plan.packageManager === 'yum'
    ? `sudo ${args}`
    : args;
  return `${privileged}; printf '\\nNode.js install command finished. Close this terminal when ready.\\n'; read -r`;
}

export function createTerminalLaunchSpec(
  plan: RuntimeInstallPlan,
  platform: NodeJS.Platform,
  terminalPath?: string,
): TerminalLaunchSpec | undefined {
  if (platform === 'darwin') {
    const script = `tell application "Terminal" to do script "${appleScriptQuote(commandLine(plan))}"`;
    return { command: 'osascript', args: ['-e', script] };
  }

  if (platform === 'win32') {
    const command = [plan.command, ...plan.args].map(powershellQuote).join(' ');
    const script = `& ${command}; Read-Host 'Node.js install command finished. Press Enter to close this terminal'`;
    return {
      command: terminalPath ?? 'wt.exe',
      args: ['new-tab', 'powershell.exe', '-NoExit', '-Command', script],
    };
  }

  if (platform === 'linux' && terminalPath) {
    const shell = commandLine(plan);
    const isGnomeTerminal = terminalPath.endsWith('/gnome-terminal') || terminalPath === 'gnome-terminal';
    return {
      command: terminalPath,
      args: isGnomeTerminal
        ? ['--', 'bash', '-lc', shell]
        : ['-e', 'bash', '-lc', shell],
    };
  }

  return undefined;
}

export function getRuntimeInstallPlan(pathValue = process.env.PATH ?? ''): RuntimeInstallResolution {
  let osRelease = '';
  if (process.platform === 'linux') {
    try {
      osRelease = readFileSync('/etc/os-release', 'utf8');
    } catch {
      return { status: 'unsupported-platform' };
    }
  }
  return resolveRuntimeInstallPlan(process.platform, osRelease, name =>
    resolveExecutablePath(name, pathValue),
  );
}

export function launchRuntimeInstall(
  plan: RuntimeInstallPlan,
  launcher: RuntimeTerminalLauncher = systemTerminalLauncher,
  pathValue = process.env.PATH ?? '',
): Promise<void> {
  const terminalPath = process.platform === 'linux'
    ? ['gnome-terminal', 'x-terminal-emulator', 'konsole', 'xfce4-terminal']
      .map(name => resolveExecutablePath(name, pathValue))
      .find(Boolean)
    : process.platform === 'win32'
      ? resolveExecutablePath('wt.exe', pathValue)
      : undefined;
  const spec = createTerminalLaunchSpec(plan, process.platform, terminalPath);
  if (!spec) {
    return Promise.reject(
      new Error('Could not find a supported terminal. Copy the package-manager command and run it in a terminal.'),
    );
  }
  return launcher.launch(spec);
}

const systemTerminalLauncher: RuntimeTerminalLauncher = {
  launch(spec): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(spec.command, spec.args, { detached: true, stdio: 'ignore' });
      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
  },
};
