import { describe, expect, it } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  installScriptPathFor,
  resolveInstallLocation,
  resolveInstallScriptPath,
} from '../src/install-script';

describe('install locations', () => {
  it('defaults the repository location to ~/.aap-demo', () => {
    expect(resolveInstallLocation()).toBe(path.join(os.homedir(), '.aap-demo'));
  });

  it('expands a configured home-relative repository location', () => {
    expect(resolveInstallLocation('~/custom-aap-demo')).toBe(path.join(os.homedir(), 'custom-aap-demo'));
  });

  it('resolves install.sh inside the selected repository location', () => {
    expect(installScriptPathFor('/tmp/aap-demo')).toBe('/tmp/aap-demo/install.sh');
    expect(resolveInstallScriptPath('/tmp/aap-demo')).toBeUndefined();
  });
});
