import { describe, expect, it } from 'vitest';
import { isValidPullSecret } from '../src/pull-secret';

describe('isValidPullSecret', () => {
  it('accepts pull-secret JSON with an auths object', () => {
    expect(isValidPullSecret('{"auths":{"registry.redhat.io":{"auth":"token"}}}')).toBe(true);
  });

  it('rejects invalid JSON and JSON without auths', () => {
    expect(isValidPullSecret('not json')).toBe(false);
    expect(isValidPullSecret('{"docker.io":{}}')).toBe(false);
  });

  it('rejects an empty pull-secret value', () => {
    expect(isValidPullSecret('')).toBe(false);
  });
});
