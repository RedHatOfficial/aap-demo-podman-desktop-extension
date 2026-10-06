import { describe, expect, it } from 'vitest';
import { shouldShowFixSsl } from '../src/webview/ssl-ui';

describe('shouldShowFixSsl', () => {
  it('offers SSL repair only for a running cluster with unresolved TLS trust', () => {
    expect(shouldShowFixSsl({
      cluster: { state: 'running' },
      ingressCaTrust: 'not-trusted',
      routes: [],
      credentials: [],
      addons: [],
    })).toBe(true);
    expect(shouldShowFixSsl({
      cluster: { state: 'running' },
      ingressCaTrust: 'unknown',
      routes: [],
      credentials: [],
      addons: [],
    })).toBe(true);
    expect(shouldShowFixSsl({
      cluster: { state: 'running' },
      ingressCaTrust: 'trusted',
      routes: [],
      credentials: [],
      addons: [],
    })).toBe(false);
    expect(shouldShowFixSsl({
      cluster: { state: 'stopped' },
      ingressCaTrust: 'not-trusted',
      routes: [],
      credentials: [],
      addons: [],
    })).toBe(false);
  });
});
