import { describe, expect, it } from 'vitest';
import { isLocalExtensionCheckout } from '../src/extension-updater';

describe('isLocalExtensionCheckout', () => {
  it('detects a local Git checkout', () => {
    expect(isLocalExtensionCheckout('/workspace/extension', candidate => candidate.endsWith('/.git'))).toBe(true);
  });

  it('does not treat an OCI extension path as a local checkout', () => {
    expect(isLocalExtensionCheckout('/extension', () => false)).toBe(false);
  });
});
