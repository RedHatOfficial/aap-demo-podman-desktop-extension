import { describe, expect, it } from 'vitest';
import { checkPrerequisites } from '../src/prerequisites';

describe('checkPrerequisites', () => {
  it('reports a ready environment when CRC, pull secret, and memory are valid', () => {
    expect(
      checkPrerequisites(
        {
          cliPath: '/bin/sh',
          crcPath: '/bin/sh',
          cpus: 8,
          installScriptPath: '/tmp/aap-demo-install-script-does-not-exist',
          pullSecretPath: '/etc/hosts',
          memory: 24576,
        },
        '/bin',
      ),
    ).toEqual({
      crc: { available: true, path: '/bin/sh' },
      cli: { available: true, path: '/bin/sh' },
      installScript: { available: false },
      cpus: { value: 8, valid: true, minimum: 4 },
      pullSecret: { configured: true, exists: true, path: '/etc/hosts' },
      memory: { value: 24576, valid: true, minimum: 16384 },
      ready: true,
    });
  });

  it('reports actionable failures for missing inputs and insufficient memory', () => {
    expect(
      checkPrerequisites(
        {
          cliPath: 'missing-cli',
          crcPath: 'missing-crc',
          cpus: 2,
          installScriptPath: '/tmp/aap-demo-install-script-does-not-exist',
          pullSecretPath: '/tmp/missing-pull-secret',
          memory: 8192,
        },
        '/bin',
      ),
    ).toEqual({
      crc: { available: false },
      cli: { available: false },
      installScript: { available: false },
      cpus: { value: 2, valid: false, minimum: 4 },
      pullSecret: { configured: true, exists: false, path: '/tmp/missing-pull-secret' },
      memory: { value: 8192, valid: false, minimum: 16384 },
      ready: false,
    });
  });
});
