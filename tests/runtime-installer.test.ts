import { describe, expect, it } from 'vitest';
import {
  createTerminalLaunchSpec,
  resolveRuntimeInstallPlan,
} from '../src/runtime-installer';

const commandExists = (name: string): string | undefined => `/usr/bin/${name}`;

describe('resolveRuntimeInstallPlan', () => {
  it('uses Homebrew to install Node.js on macOS', () => {
    const plan = resolveRuntimeInstallPlan('darwin', '', commandExists);

    expect(plan).toEqual({
      status: 'ready',
      packageManager: 'brew',
      command: '/usr/bin/brew',
      args: ['install', 'node'],
    });
  });

  it('uses WinGet to install the Node.js LTS package on Windows', () => {
    const plan = resolveRuntimeInstallPlan('win32', '', name =>
      name === 'winget.exe' ? 'C:\\WindowsApps\\winget.exe' : undefined,
    );

    expect(plan).toEqual({
      status: 'ready',
      packageManager: 'winget',
      command: 'C:\\WindowsApps\\winget.exe',
      args: ['install', '--id', 'OpenJS.NodeJS.LTS', '--exact', '--interactive'],
    });
  });

  it('uses DNF for a RHEL-family Linux distribution', () => {
    const plan = resolveRuntimeInstallPlan(
      'linux',
      'ID="rocky"\nID_LIKE="rhel centos fedora"\n',
      commandExists,
    );

    expect(plan).toEqual({
      status: 'ready',
      packageManager: 'dnf',
      command: '/usr/bin/dnf',
      args: ['install', 'nodejs', 'npm'],
    });
  });

  it('uses yum when a RHEL derivative has no DNF executable', () => {
    const plan = resolveRuntimeInstallPlan(
      'linux',
      'ID=centos\n',
      name => name === 'yum' ? '/usr/bin/yum' : undefined,
    );

    expect(plan).toMatchObject({ status: 'ready', packageManager: 'yum' });
  });

  it('reports when a supported platform is missing its package manager', () => {
    expect(resolveRuntimeInstallPlan('darwin', '', () => undefined)).toEqual({
      status: 'package-manager-missing',
      packageManager: 'brew',
    });
  });

  it('does not guess package commands for unsupported Linux distributions', () => {
    expect(resolveRuntimeInstallPlan('linux', 'ID=ubuntu\n', commandExists)).toEqual({
      status: 'unsupported-platform',
    });
  });
});

describe('createTerminalLaunchSpec', () => {
  const dnfPlan = {
    status: 'ready' as const,
    packageManager: 'dnf' as const,
    command: '/usr/bin/dnf',
    args: ['install', 'nodejs', 'npm'],
  };

  it('opens a visible macOS Terminal with the package-manager command', () => {
    const spec = createTerminalLaunchSpec(dnfPlan, 'darwin');
    expect(spec?.command).toBe('osascript');
    expect(spec?.args.join(' ')).toContain('Terminal');
  });

  it('uses the selected Windows terminal and leaves the session open', () => {
    const spec = createTerminalLaunchSpec(
      {
        status: 'ready',
        packageManager: 'winget',
        command: 'winget',
        args: ['install', '--id', 'OpenJS.NodeJS.LTS', '--exact', '--interactive'],
      },
      'win32',
    );

    expect(spec?.command).toBe('wt.exe');
    expect(spec?.args.join(' ')).toContain('OpenJS.NodeJS.LTS');
  });

  it('uses an available Linux terminal and holds it open for prompts', () => {
    const spec = createTerminalLaunchSpec(dnfPlan, 'linux', '/usr/bin/gnome-terminal');

    expect(spec?.command).toBe('/usr/bin/gnome-terminal');
    expect(spec?.args.join(' ')).toContain('sudo');
    expect(spec?.args.join(' ')).toContain('read');
  });

  it('returns no launch command when a Linux terminal cannot be found', () => {
    expect(createTerminalLaunchSpec(dnfPlan, 'linux')).toBeUndefined();
  });
});
