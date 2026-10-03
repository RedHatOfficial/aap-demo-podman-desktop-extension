import { describe, expect, it } from 'vitest';
import { resolveInstallScriptPath } from '../src/install-script';

describe('resolveInstallScriptPath', () => {
  it('uses a configured readable install script path', () => {
    expect(resolveInstallScriptPath('/bin/sh')).toBe('/bin/sh');
  });

  it('returns undefined when the configured script does not exist', () => {
    expect(resolveInstallScriptPath('/tmp/aap-demo-install-script-does-not-exist')).toBeUndefined();
  });
});
