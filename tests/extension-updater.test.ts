import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { isLocalExtensionCheckout } from '../src/extension-updater';

describe('isLocalExtensionCheckout', () => {
  it('detects a local Git checkout', () => {
    expect(isLocalExtensionCheckout('/workspace/extension', candidate => path.basename(candidate) === '.git')).toBe(true);
  });

  it('does not treat an OCI extension path as a local checkout', () => {
    expect(isLocalExtensionCheckout('/extension', () => false)).toBe(false);
  });
});
