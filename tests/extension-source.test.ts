import { describe, expect, it } from 'vitest';
import {
  getExtensionCheckoutAction,
  parseNodeMajorVersion,
  resolveExtensionInstallLocation,
} from '../src/extension-source';

describe('resolveExtensionInstallLocation', () => {
  it('uses the default checkout location when the setting is blank', () => {
    expect(resolveExtensionInstallLocation('', '/home/test')).toBe(
      '/home/test/.aap-demo-podman-desktop-extension',
    );
  });

  it('expands a home-relative checkout location', () => {
    expect(
      resolveExtensionInstallLocation('~/.aap-demo-podman-desktop-extension', '/home/test'),
    ).toBe('/home/test/.aap-demo-podman-desktop-extension');
  });

  it('keeps an absolute checkout location unchanged', () => {
    expect(resolveExtensionInstallLocation('/tmp/extension', '/home/test')).toBe(
      '/tmp/extension',
    );
  });
});

describe('getExtensionCheckoutAction', () => {
  it('clones when the checkout does not exist', () => {
    expect(getExtensionCheckoutAction(false, false)).toBe('clone');
  });

  it('updates an existing Git checkout', () => {
    expect(getExtensionCheckoutAction(true, true)).toBe('update');
  });

  it('refuses an existing directory without Git metadata', () => {
    expect(getExtensionCheckoutAction(true, false)).toBe('refuse');
  });
});

describe('parseNodeMajorVersion', () => {
  it('returns the major version from Node version output', () => {
    expect(parseNodeMajorVersion('v24.1.0')).toBe(24);
    expect(parseNodeMajorVersion('26.0.0')).toBe(26);
  });

  it('rejects malformed Node version output', () => {
    expect(parseNodeMajorVersion('node unavailable')).toBeUndefined();
    expect(parseNodeMajorVersion('v24')).toBeUndefined();
  });
});
