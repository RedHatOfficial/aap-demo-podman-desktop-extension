import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardSource = readFileSync(resolve(__dirname, '../src/webview/dashboard.ts'), 'utf8');
const dashboardHtml = readFileSync(resolve(__dirname, '../src/webview/index.html'), 'utf8');

describe('route copy behavior', () => {
  it('keeps route navigation separate from local copying', () => {
    expect(dashboardSource).toContain("import { copyText } from './clipboard';");
    expect(dashboardSource).toContain('const copied = await copyText(value);');
    expect(dashboardSource).toContain("copy.textContent = 'Copy failed'");
    expect(dashboardSource).toContain("postToHost({ type: 'open-url', url });");
    expect(dashboardHtml).toContain('.route-actions');
  });
});
