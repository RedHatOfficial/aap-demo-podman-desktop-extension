import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  installScriptPathFor,
  bashScriptInvocation,
  installToolHint,
  resolveBashScriptPath,
  resolveAapDemoSourceLocation,
  resolveInstallLocation,
  resolveInstallScriptPath,
} from '../src/install-script';

describe('install locations', () => {
  it('defaults the repository location to ~/.aap-demo/aap-demo', () => {
    expect(resolveInstallLocation()).toBe(path.join(os.homedir(), '.aap-demo', 'aap-demo'));
  });

  it('expands a configured home-relative repository location', () => {
    expect(resolveInstallLocation('~/custom-aap-demo')).toBe(path.join(os.homedir(), 'custom-aap-demo'));
  });

  it('resolves install.sh inside the selected repository location', () => {
    expect(installScriptPathFor('/tmp/aap-demo')).toBe('/tmp/aap-demo/install.sh');
    expect(resolveInstallScriptPath('/tmp/aap-demo')).toBeUndefined();
  });

  it('converts Windows paths to slash-separated paths for Bash', () => {
    expect(resolveBashScriptPath('C:\\Users\\adler\\.aap-demo\\aap-demo\\install.sh', 'win32'))
      .toBe('C:/Users/adler/.aap-demo/aap-demo/install.sh');
  });

  it('leaves POSIX script paths unchanged for Bash', () => {
    expect(resolveBashScriptPath('/home/adler/.aap-demo/aap-demo/install.sh', 'darwin'))
      .toBe('/home/adler/.aap-demo/aap-demo/install.sh');
  });

  it('uses Git Bash path conversion on Windows', () => {
    expect(bashScriptInvocation('C:\\Users\\adler\\.aap-demo\\aap-demo\\install.sh', 'win32'))
      .toEqual(['C:/Users/adler/.aap-demo/aap-demo/install.sh']);
  });

  it('explains the Windows Bash requirement', () => {
    expect(installToolHint('bash', 'win32')).toContain('Git for Windows');
    expect(installToolHint('git', 'win32')).toContain('Git for Windows');
  });

  it('uses an existing aap-demo checkout at the configured location', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-source-'));
    const checkout = path.join(parent, '.aap-demo');
    mkdirSync(checkout);
    writeFileSync(path.join(checkout, 'install.sh'), '#!/bin/sh\n');
    writeFileSync(path.join(checkout, 'aap-demo.sh'), '#!/bin/sh\n');

    try {
      expect(resolveAapDemoSourceLocation(checkout)).toBe(checkout);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('chooses an aap-demo child checkout when the configured directory is occupied', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-source-'));
    const dataDir = path.join(parent, '.aap-demo');
    const checkout = path.join(dataDir, 'aap-demo');
    mkdirSync(dataDir);
    writeFileSync(path.join(dataDir, 'config'), 'INFRA=crc\n');
    mkdirSync(checkout);
    writeFileSync(path.join(checkout, 'install.sh'), '#!/bin/sh\n');
    writeFileSync(path.join(checkout, 'aap-demo.sh'), '#!/bin/sh\n');

    try {
      expect(resolveAapDemoSourceLocation(dataDir)).toBe(checkout);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('prefers a nested aap-demo checkout when the parent has Git metadata', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-source-'));
    const dataDir = path.join(parent, '.aap-demo');
    const checkout = path.join(dataDir, 'aap-demo');
    mkdirSync(path.join(dataDir, '.git'), { recursive: true });
    mkdirSync(checkout);
    writeFileSync(path.join(checkout, 'install.sh'), '#!/bin/sh\n');
    writeFileSync(path.join(checkout, 'aap-demo.sh'), '#!/bin/sh\n');

    try {
      expect(resolveAapDemoSourceLocation(dataDir)).toBe(checkout);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('selects a child checkout target when the configured directory has unrelated files', () => {
    const parent = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-source-'));
    const dataDir = path.join(parent, '.aap-demo');
    const checkout = path.join(dataDir, 'aap-demo');
    mkdirSync(dataDir);
    writeFileSync(path.join(dataDir, 'pull-secret.txt'), 'private');

    try {
      expect(resolveAapDemoSourceLocation(dataDir)).toBe(checkout);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
