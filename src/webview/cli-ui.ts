type TextElement = Pick<HTMLElement, 'textContent'> | null;
type StatusDotElement = Pick<HTMLElement, 'className'> | null;
type CliButtonElement = Pick<HTMLButtonElement, 'disabled' | 'hidden' | 'title'> | null;

export interface CliMissingUi {
  statusState: TextElement;
  statusDot: StatusDotElement;
  statusSummary: TextElement;
  toolVersion: TextElement;
  installCli: CliButtonElement;
  updateCli: CliButtonElement;
}

export type CliBackend = 'legacy' | 'python';

export interface CliMissingOptions {
  backend?: CliBackend;
  message?: string;
}

export function handleCliMissing(
  ui: CliMissingUi,
  writeOutput: (text: string) => void,
  options: CliMissingOptions = {},
): void {
  if (options.backend === 'python') {
    if (ui.statusState) ui.statusState.textContent = 'Python CLI not installed';
    if (ui.statusDot) ui.statusDot.className = 'status-dot unknown';
    if (ui.statusSummary) {
      ui.statusSummary.textContent = 'Install aap-demo==2.0.0.dev2 to manage the environment.';
    }
    if (ui.toolVersion) ui.toolVersion.textContent = 'Python CLI: not installed';
    if (ui.installCli) {
      ui.installCli.hidden = true;
      ui.installCli.disabled = true;
    }
    if (ui.updateCli) {
      ui.updateCli.hidden = true;
      ui.updateCli.disabled = true;
    }
    writeOutput(options.message ?? 'The Python aap-demo CLI is missing. Install aap-demo==2.0.0.dev2 and try again.');
    return;
  }

  if (ui.statusState) ui.statusState.textContent = 'CLI not installed';
  if (ui.statusDot) ui.statusDot.className = 'status-dot unknown';
  if (ui.statusSummary) {
    ui.statusSummary.textContent = 'Install aap-demo in the Status box to get started.';
  }
  if (ui.toolVersion) ui.toolVersion.textContent = 'CLI: not installed';
  if (ui.installCli) {
    ui.installCli.hidden = false;
    ui.installCli.disabled = false;
    ui.installCli.title = 'Clone or reuse the aap-demo source and run install.sh';
  }
  if (ui.updateCli) {
    ui.updateCli.hidden = true;
    ui.updateCli.disabled = false;
  }
  writeOutput(
    'The aap-demo CLI is missing. Use Install aap-demo in the Status box to clone or reuse the repository source and run its installer.',
  );
}
