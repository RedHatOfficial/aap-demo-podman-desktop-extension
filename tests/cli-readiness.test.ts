import { describe, expect, it } from 'vitest';
import { canInvokeCli, missingCliMessage } from '../src/cli-readiness';

describe('missingCliMessage', () => {
  it('explains how to install the default CLI', () => {
    const message = missingCliMessage('aap-demo');

    expect(message).toContain('aap-demo');
    expect(message).toContain('Install aap-demo');
    expect(message).toContain('aap-demo.cliPath');
  });

  it('preserves a custom configured path for troubleshooting', () => {
    expect(missingCliMessage('/custom/aap-demo')).toContain('/custom/aap-demo');
  });
});

describe('canInvokeCli', () => {
  it('uses the Flatpak host bridge instead of the sandbox CLI path', () => {
    expect(canInvokeCli('missing-cli', '/bin', { FLATPAK_ID: 'io.podman_desktop.PodmanDesktop' }, 'linux')).toBe(false);
  });
});
