import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
    expect(dashboardSource).toContain("message.type === 'copy-result'");
    expect(extensionSource).toContain('await extensionApi.env.clipboard.writeText(message.text)');
    expect(extensionSource).toContain("type: 'copy-result'");
    expect(extensionSource).toContain('await openExternalUrl(message.url, runner, settings.pathValue, process.env)');
    expect(protocolSource).toContain("candidate.type === 'copy-text'");
    expect(dashboardHtml).toContain('id="routes"');
  });
});
