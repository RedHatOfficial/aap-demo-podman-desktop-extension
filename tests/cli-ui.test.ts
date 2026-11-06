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
    expect(ui.installCli.title).toBe('Clone or reuse the aap-demo source and run install.sh');
    expect(ui.updateCli.hidden).toBe(true);
    expect(ui.statusState.textContent).toBe('CLI not installed');
    expect(ui.statusSummary.textContent).toBe('Install aap-demo in the Status box to get started.');
    expect(ui.toolVersion.textContent).toBe('CLI: not installed');
    expect(output).toEqual([
      'The aap-demo CLI is missing. Use Install aap-demo in the Status box to clone or reuse the repository source and run its installer.',
    ]);
  });

  it('does not offer the legacy installer when the Python CLI is missing', () => {
    const ui = {
      statusState: { textContent: 'Running' },
      statusDot: { className: 'status-dot running' },
      statusSummary: { textContent: 'Cluster ready' },
      toolVersion: { textContent: 'CLI: unknown' },
      installCli: { hidden: false, disabled: false, title: 'legacy installer' },
      updateCli: { hidden: false, disabled: false, title: '' },
    };
    const output: string[] = [];

    handleCliMissing(ui, message => output.push(message), {
      backend: 'python',
      message: 'Python CLI is missing at /custom/aap-demo.',
    });

    expect(ui.installCli.hidden).toBe(true);
    expect(ui.installCli.disabled).toBe(true);
    expect(ui.updateCli.hidden).toBe(true);
    expect(ui.updateCli.disabled).toBe(true);
    expect(ui.statusState.textContent).toBe('Python CLI not installed');
    expect(ui.statusSummary.textContent).toBe('Install aap-demo==2.0.0.dev2 to manage the environment.');
    expect(ui.toolVersion.textContent).toBe('Python CLI: not installed');
    expect(output).toEqual(['Python CLI is missing at /custom/aap-demo.']);
  });
});
