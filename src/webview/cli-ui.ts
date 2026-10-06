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

export function handleCliMissing(ui: CliMissingUi, writeOutput: (text: string) => void): void {
  if (ui.statusState) ui.statusState.textContent = 'CLI not installed';
  if (ui.statusDot) ui.statusDot.className = 'status-dot unknown';
  if (ui.statusSummary) {
    ui.statusSummary.textContent = 'Install aap-demo in the Status box to get started.';
  }
  if (ui.toolVersion) ui.toolVersion.textContent = 'CLI: not installed';
  if (ui.installCli) {
    ui.installCli.hidden = false;
    ui.installCli.disabled = false;
    ui.installCli.title = 'Clone the aap-demo repository and run install.sh';
  }
  if (ui.updateCli) {
    ui.updateCli.hidden = true;
    ui.updateCli.disabled = false;
  }
  writeOutput(
    'The aap-demo CLI is missing. Use Install aap-demo in the Status box to clone the repository and run its installer.',
  );
}
