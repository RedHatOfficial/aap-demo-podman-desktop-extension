import { describe, expect, it } from 'vitest';
import { createTrustCaTerminalLaunchSpec } from '../src/trust-ca-terminal';

describe('createTrustCaTerminalLaunchSpec', () => {
  it('opens a visible macOS Terminal that runs Fix SSL interactively', () => {
    const spec = createTrustCaTerminalLaunchSpec(
      '/Users/test/.local/bin/aap-demo',
      '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin',
      'darwin',
    );

    expect(spec?.command).toBe('osascript');
    expect(spec?.args.join(' ')).toContain('Terminal');
    expect(spec?.args.join(' ')).toContain('/Users/test/.local/bin/aap-demo');
    expect(spec?.args.join(' ')).toContain('trust-ca');
    expect(spec?.args.join(' ')).toContain('PYTHONUTF8');
    expect(spec?.args.join(' ')).toContain('read -r');
  });

  it('does not create a terminal launch command on non-macOS platforms', () => {
    expect(createTrustCaTerminalLaunchSpec('aap-demo', '/usr/bin:/bin', 'linux')).toBeUndefined();
  });
});
