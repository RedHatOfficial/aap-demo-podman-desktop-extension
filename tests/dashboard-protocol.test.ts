import { describe, expect, it } from 'vitest';
import { isDashboardMessage, safeExternalUrl, unwrapDashboardMessage } from '../src/dashboard-protocol';

describe('safeExternalUrl', () => {
  it('returns only normalized HTTP(S) URLs for external navigation', () => {
    expect(safeExternalUrl('https://example.test/path')).toBe('https://example.test/path');
    expect(safeExternalUrl('http://example.test/')).toBe('http://example.test/');
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalUrl('data:text/html,hello')).toBeUndefined();
    expect(safeExternalUrl('not a URL')).toBeUndefined();
  });
});

describe('isDashboardMessage', () => {
  it('accepts the webview ready handshake', () => {
    expect(isDashboardMessage({ type: 'ready' })).toBe(true);
  });

  it('accepts supported lifecycle actions', () => {
    expect(isDashboardMessage({ type: 'run', action: 'status' })).toBe(true);
    expect(isDashboardMessage({ type: 'run', action: 'start' })).toBe(true);
    expect(isDashboardMessage({ type: 'run', action: 'stop' })).toBe(true);
  });

  it('accepts an install CLI request from the dashboard', () => {
    expect(isDashboardMessage({ type: 'install-cli' })).toBe(true);
  });

  it('accepts an update CLI request from the dashboard', () => {
    expect(isDashboardMessage({ type: 'update-cli' })).toBe(true);
  });

  it('accepts a local extension update request from the dashboard', () => {
    expect(isDashboardMessage({ type: 'update-extension' })).toBe(true);
  });

  it('accepts local extension setup and runtime recovery requests', () => {
    expect(isDashboardMessage({ type: 'setup-extension' })).toBe(true);
    expect(isDashboardMessage({ type: 'install-runtime' })).toBe(true);
    expect(isDashboardMessage({ type: 'check-runtime' })).toBe(true);
  });

  it('accepts safe external URL requests', () => {
    expect(isDashboardMessage({ type: 'open-url', url: 'https://example.test/path' })).toBe(true);
  });

  it('accepts the fixed OpenShift Local install handoff request', () => {
    expect(isDashboardMessage({ type: 'open-crc-extension' })).toBe(true);
  });

  it('rejects unsupported messages', () => {
    expect(isDashboardMessage({ type: 'run', action: 'shell' })).toBe(false);
    expect(isDashboardMessage({ type: 'open-url', url: 'file:///etc/passwd' })).toBe(false);
    expect(isDashboardMessage({ type: 'open-url', url: 'javascript:alert(1)' })).toBe(false);
  });
});

describe('unwrapDashboardMessage', () => {
  it('keeps direct messages unchanged', () => {
    const message = { type: 'status' };
    expect(unwrapDashboardMessage(message)).toBe(message);
  });

  it('unwraps string and envelope payloads', () => {
    const message = { type: 'status' };
    expect(unwrapDashboardMessage(JSON.stringify(message))).toEqual(message);
    expect(unwrapDashboardMessage({ message })).toBe(message);
  });

  it('unwraps nested data and payload envelopes', () => {
    const message = { type: 'status' };
    expect(unwrapDashboardMessage({ data: { payload: message } })).toBe(message);
  });
});
