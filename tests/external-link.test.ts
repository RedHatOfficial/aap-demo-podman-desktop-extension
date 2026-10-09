import { describe, expect, it } from 'vitest';
import { externalOpenFailed } from '../src/external-link';

describe('externalOpenFailed', () => {
  it('does not treat an omitted host result as an opening failure', () => {
    expect(externalOpenFailed(undefined)).toBe(false);
  });

  it('treats an explicit false host result as an opening failure', () => {
    expect(externalOpenFailed(false)).toBe(true);
    expect(externalOpenFailed(true)).toBe(false);
  });
});
