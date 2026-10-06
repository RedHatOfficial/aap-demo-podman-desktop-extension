import { describe, expect, it } from 'vitest';
import { handleCliMissing } from '../src/webview/cli-ui';

describe('handleCliMissing', () => {
  it('reveals the install action and reports that the CLI is missing', () => {
    const ui = {
      statusState: { textContent: 'Running' },
      statusDot: { className: 'status-dot running' },
      statusSummary: { textContent: 'Cluster ready' },
      toolVersion: { textContent: 'CLI: unknown' },
      installCli: { hidden: true, disabled: true, title: '' },
      updateCli: { hidden: false, disabled: false, title: '' },
    };
    const output: string[] = [];

    handleCliMissing(ui, message => output.push(message));

    expect(ui.installCli.hidden).toBe(false);
    expect(ui.installCli.disabled).toBe(false);
    expect(ui.updateCli.hidden).toBe(true);
    expect(ui.statusState.textContent).toBe('CLI not installed');
    expect(ui.statusSummary.textContent).toBe('Install aap-demo in the Status box to get started.');
    expect(ui.toolVersion.textContent).toBe('CLI: not installed');
    expect(output).toEqual([
      'The aap-demo CLI is missing. Use Install aap-demo in the Status box to clone the repository and run its installer.',
    ]);
  });
});
