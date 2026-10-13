import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../src/extension.ts'), 'utf8');

describe('status polling lifetime', () => {
  it('owns one poller outside the dashboard panel lifecycle', () => {
    const openDashboard = source.indexOf("const openDashboard =");
    const statusPoll = source.indexOf("const statusPoll = setInterval(() => void runAction('status'), 30_000);");

    expect(statusPoll).toBeGreaterThanOrEqual(0);
    expect(statusPoll).toBeLessThan(openDashboard);
    expect(source.slice(openDashboard)).not.toContain('setInterval(() => void runAction');
    expect(source).toContain('clearInterval(statusPoll)');
  });

  it('refreshes status when an existing dashboard is opened again', () => {
    const openDashboard = source.indexOf("const openDashboard =");
    const existingPanelBranch = source.slice(
      openDashboard,
      source.indexOf("panel = extensionApi.window.createWebviewPanel", openDashboard),
    );

    expect(existingPanelBranch).toMatch(/panel\.reveal\(\);[\s\S]*void runAction\('status'\);/);
  });

  it('does not gate reopen refresh on a host platform', () => {
    const openDashboard = source.indexOf("const openDashboard =");
    const existingPanelBranch = source.slice(
      openDashboard,
      source.indexOf("panel = extensionApi.window.createWebviewPanel", openDashboard),
    );

    expect(existingPanelBranch).not.toContain('process.platform');
  });
});
