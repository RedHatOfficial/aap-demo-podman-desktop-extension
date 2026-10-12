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
});
