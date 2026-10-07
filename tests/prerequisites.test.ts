import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkPrerequisites } from '../src/prerequisites';

function withTemporaryExecutable<T>(callback: (executable: string, directory: string) => T): T {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-prereq-'));
  const executable = path.join(directory, 'tool');
  writeFileSync(executable, '#!/bin/sh\n');
  try {
    return callback(executable, directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('checkPrerequisites', () => {
  it('rejects a CRC CPU allocation below the eight-CPU minimum', () => {
    const status = withTemporaryExecutable((executable, directory) => checkPrerequisites(
        {
          cliPath: executable,
          crcPath: executable,
          cpus: 7,
          pullSecretPath: executable,
        },
        directory,
      ));

    expect(status.cpus).toEqual({ value: 7, valid: false, minimum: 8 });
    expect(status.ready).toBe(false);
  });

  it('reports a ready environment when CRC, pull secret, and memory are valid', () => {
    withTemporaryExecutable((executable, directory) => {
      expect(checkPrerequisites(
        {
          cliPath: executable,
          crcPath: executable,
          cpus: 8,
          installLocation: path.join(os.tmpdir(), 'aap-demo-install-location-does-not-exist'),
          pullSecretPath: executable,
          memory: 24576,
        },
        directory,
      )).toEqual({
        crc: { available: true, path: executable },
        cli: { available: true, path: executable },
        installScript: { available: false },
        cpus: { value: 8, valid: true, minimum: 8 },
        pullSecret: { configured: true, exists: true, path: executable },
        memory: { value: 24576, valid: true, minimum: 16384 },
        ready: true,
      });
    });
  });

  it('reports the Windows PowerShell installer when the checkout is available', () => {
    withTemporaryExecutable((executable, directory) => {
      const parent = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-prereq-checkout-'));
      const checkout = path.join(parent, 'aap-demo');
      const installer = path.join(checkout, 'powershell', 'install.ps1');
      mkdirSync(path.dirname(installer), { recursive: true });
      writeFileSync(path.join(checkout, 'install.sh'), '#!/bin/sh\n');
      writeFileSync(path.join(checkout, 'aap-demo.sh'), '#!/bin/sh\n');
      writeFileSync(installer, 'Write-Host install\n');

      try {
        expect(checkPrerequisites(
          {
            cliPath: executable,
            crcPath: executable,
            installLocation: checkout,
            pullSecretPath: executable,
          },
          directory,
          'win32',
        ).installScript).toEqual({ available: true, path: installer });
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    });
  });

  it('reports actionable failures for missing inputs and insufficient memory', () => {
    expect(
      checkPrerequisites(
        {
          cliPath: 'missing-cli',
          crcPath: 'missing-crc',
          cpus: 2,
          installLocation: '/tmp/aap-demo-install-location-does-not-exist',
          pullSecretPath: '/tmp/missing-pull-secret',
          memory: 8192,
        },
        '/bin',
      ),
    ).toEqual({
      crc: { available: false },
      cli: { available: false },
      installScript: { available: false },
      cpus: { value: 2, valid: false, minimum: 8 },
      pullSecret: { configured: true, exists: false, path: '/tmp/missing-pull-secret' },
      memory: { value: 8192, valid: false, minimum: 16384 },
      ready: false,
    });
  });
});
