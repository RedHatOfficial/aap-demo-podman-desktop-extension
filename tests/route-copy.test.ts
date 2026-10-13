import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDashboardCopyResultMessage } from '../src/dashboard-protocol';

const dashboardSource = readFileSync(resolve(__dirname, '../src/webview/dashboard.ts'), 'utf8');
const dashboardHtml = readFileSync(resolve(__dirname, '../src/webview/index.html'), 'utf8');
const extensionSource = readFileSync(resolve(__dirname, '../src/extension.ts'), 'utf8');
const protocolSource = readFileSync(resolve(__dirname, '../src/dashboard-protocol.ts'), 'utf8');

describe('route copy behavior', () => {
  it('keeps route navigation separate from local copying', () => {
    expect(dashboardSource).toContain("import { copyText } from './clipboard';");
    expect(dashboardSource).toContain('let copied = await copyText(value);');
    expect(dashboardSource).toContain("button.textContent = copied ? 'Copied' : 'Copy failed'");
    expect(dashboardSource).toContain("postToHost({ type: 'open-url', url: safeUrl });");
    expect(dashboardSource).toContain("postToHost({ type: 'copy-text', requestId, text: value });");
    expect(dashboardSource).toContain('isDashboardCopyResultMessage(unwrappedMessage)');
    expect(dashboardSource).not.toContain('pendingCopyRequests.get(unwrappedMessage.requestId)');
    expect(dashboardSource).toContain('pendingCopy.resolve(unwrappedMessage.copied);');
    expect(extensionSource).toContain('await extensionApi.env.clipboard.writeText(message.text)');
    expect(extensionSource).toContain("type: 'copy-result'");
    expect(extensionSource).toContain('await openExternalUrl(message.url, runner, settings.pathValue, process.env)');
    expect(protocolSource).toContain("candidate.type === 'copy-text'");
    expect(dashboardHtml).toContain('id="routes"');
  });

  it('accepts only generated copy-result messages before invoking a callback', () => {
    expect(isDashboardCopyResultMessage({ type: 'copy-result', requestId: 'copy-1', copied: true })).toBe(true);
    expect(isDashboardCopyResultMessage({ type: 'copy-result', requestId: 'other-1', copied: true })).toBe(false);
    expect(isDashboardCopyResultMessage({ type: 'copy-result', requestId: 'copy-1', copied: 'yes' })).toBe(false);
    expect(isDashboardCopyResultMessage({ type: 'copy-result', requestId: 'copy-1', copied: true, resolve: 'alert' })).toBe(false);
  });
});
