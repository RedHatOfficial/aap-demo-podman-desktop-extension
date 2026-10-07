import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { augmentPath, resolveConfiguredExecutable, resolveExecutablePath } from '../src/executable-path';

const temporaryRoots: string[] = [];

function createExecutable(name: string): { directory: string; executable: string } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-path-'));
  const executable = path.join(directory, name);
  writeFileSync(executable, '#!/bin/sh\n');
  return { directory, executable };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('resolveExecutablePath', () => {
  it('finds an executable in the supplied PATH', () => {
    const { directory, executable } = createExecutable('aap-demo-test');
    temporaryRoots.push(directory);

    expect(resolveExecutablePath('aap-demo-test', directory)).toBe(executable);
  });

  it('finds a Windows executable through PATHEXT', () => {
    const { directory, executable } = createExecutable('crc.exe');
    temporaryRoots.push(directory);

    expect(resolveExecutablePath('crc', directory, {
      pathExt: '.COM;.EXE;.BAT;.CMD',
      platform: 'win32',
    })).toBe(executable);
  });

  it('accepts an explicit executable path', () => {
    const { directory, executable } = createExecutable('aap-demo-test');
    temporaryRoots.push(directory);

    expect(resolveExecutablePath(executable, '')).toBe(executable);
  });

  it('accepts an explicit Windows executable path without the extension', () => {
    const { directory, executable } = createExecutable('crc.exe');
    temporaryRoots.push(directory);

    expect(resolveExecutablePath(path.join(directory, 'crc'), '', {
      pathExt: '.EXE',
      platform: 'win32',
    })).toBe(executable);
  });

  it('returns undefined when the executable cannot be found', () => {
    const { directory } = createExecutable('aap-demo-test');
    temporaryRoots.push(directory);

    expect(resolveExecutablePath('definitely-not-installed', directory)).toBeUndefined();
  });
});

describe('resolveConfiguredExecutable', () => {
  it('returns the absolute path for a configured executable name', () => {
    const { directory, executable } = createExecutable('aap-demo-test');
    temporaryRoots.push(directory);

    expect(resolveConfiguredExecutable('aap-demo-test', directory)).toBe(executable);
  });

  it('preserves an unresolved configured value for a useful spawn error', () => {
    const { directory } = createExecutable('aap-demo-test');
    temporaryRoots.push(directory);

    expect(resolveConfiguredExecutable('definitely-not-installed', directory)).toBe(
      'definitely-not-installed',
    );
  });

  it('expands a leading tilde in a configured executable path', () => {
    expect(resolveConfiguredExecutable('~/missing/aap-demo', '/bin:/usr/bin')).toBe(
      path.join(os.homedir(), 'missing', 'aap-demo'),
    );
  });
});

describe('augmentPath', () => {
  it('adds common user and package-manager executable directories', () => {
    const suppliedPaths = [path.join(os.tmpdir(), 'aap-demo-bin'), path.join(os.tmpdir(), 'aap-demo-usr-bin')];
    const augmented = augmentPath(suppliedPaths.join(path.delimiter));

    expect(augmented.split(path.delimiter)).toEqual(expect.arrayContaining([
      ...suppliedPaths,
      '/usr/local/bin',
      '/opt/homebrew/bin',
      path.join(os.homedir(), '.crc', 'bin'),
      path.join(os.homedir(), '.local', 'bin'),
    ]));
  });
});
