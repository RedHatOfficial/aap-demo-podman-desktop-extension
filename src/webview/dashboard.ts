import type { AapDemoStatus } from '../status-parser';
import type { PrerequisiteStatus } from '../prerequisites';
import { safeExternalUrl, unwrapDashboardMessage } from '../dashboard-protocol';
import { acquireDesktopApi, type DesktopApi } from './desktop-api';
import { getAddonTogglePresentation, renderableAddons } from './addon-ui';
import { handleCliMissing } from './cli-ui';
import { shouldShowFixSsl } from './ssl-ui';

export {};

interface DashboardStatusMessage {
  type: 'status';
  status: AapDemoStatus;
}

interface DashboardPrerequisitesMessage {
  type: 'prerequisites';
  prerequisites: PrerequisiteStatus;
}

interface DashboardExtensionMessage {
  type: 'extension-update-available';
  available: boolean;
  setupAvailable?: boolean;
}

interface DashboardRuntimeRequiredMessage {
  type: 'runtime-required';
  runtime: 'node' | 'npm';
  reason: 'missing' | 'outdated' | 'unusable';
  message: string;
  installAvailable: boolean;
  packageManager?: string;
}

interface DashboardRuntimeInstallUnavailableMessage {
  type: 'runtime-install-unavailable';
  message: string;
}

interface DashboardRuntimeTerminalOpenedMessage {
  type: 'runtime-terminal-opened';
  packageManager: string;
}

interface DashboardExtensionSetupCompleteMessage {
  type: 'extension-setup-complete';
  path: string;
}

interface DashboardPahTokenRequestMessage {
  type: 'pah-token-request';
}

interface DashboardCommandMessage {
  type: 'command-result' | 'addon-result' | 'command-output' | 'command-error';
  action?: string;
  addon?: string;
  stream?: string;
  text?: string;
  stdout?: string;
  stderr?: string;
  message?: string;
}

interface DashboardCliMessage {
  type: 'cli-missing';
}

declare function acquirePodmanDesktopApi(): DesktopApi;

const desktopApi = acquireDesktopApi(
  typeof acquirePodmanDesktopApi === 'function' ? acquirePodmanDesktopApi : undefined,
);
const output = document.querySelector<HTMLPreElement>('#output');
const statusSummary = document.querySelector<HTMLParagraphElement>('#status-summary');
const statusState = document.querySelector<HTMLSpanElement>('#status-state');
const statusDot = document.querySelector<HTMLSpanElement>('#status-dot');
const lastUpdated = document.querySelector<HTMLSpanElement>('#last-updated');
const infra = document.querySelector<HTMLParagraphElement>('#infra');
const kubeconfig = document.querySelector<HTMLParagraphElement>('#kubeconfig');
const toolVersion = document.querySelector<HTMLParagraphElement>('#tool-version');
const routes = document.querySelector<HTMLDivElement>('#routes');
const credentials = document.querySelector<HTMLDivElement>('#credentials');
const addonActions = document.querySelector<HTMLDivElement>('#addon-actions');
const prerequisiteList = document.querySelector<HTMLDivElement>('#prerequisite-list');
const installCli = document.querySelector<HTMLButtonElement>('#install-cli');
const updateCli = document.querySelector<HTMLButtonElement>('#update-cli');
const setupExtension = document.querySelector<HTMLButtonElement>('#setup-extension');
const updateExtension = document.querySelector<HTMLButtonElement>('#update-extension');
const runtimeHelp = document.querySelector<HTMLDivElement>('#extension-runtime-help');
const runtimeMessage = document.querySelector<HTMLParagraphElement>('#extension-runtime-message');
const installRuntime = document.querySelector<HTMLButtonElement>('#install-runtime');
const checkRuntime = document.querySelector<HTMLButtonElement>('#check-runtime');
const runtimeManualGuide = document.querySelector<HTMLAnchorElement>('#runtime-manual-guide');
const idleToggle = document.querySelector<HTMLButtonElement>('#idle-toggle');
const fixSslButton = document.querySelector<HTMLButtonElement>('#fix-ssl');
const pahTokenDialog = document.querySelector<HTMLDivElement>('#pah-token-dialog');
const pahTokenInput = document.querySelector<HTMLTextAreaElement>('#pah-token-input');
const pahTokenError = document.querySelector<HTMLParagraphElement>('#pah-token-error');
const pahTokenCancel = document.querySelector<HTMLButtonElement>('#pah-token-cancel');
const pahTokenSave = document.querySelector<HTMLButtonElement>('#pah-token-save');
let idleState = true;

function clear(element: Element | null): void {
  if (element) element.replaceChildren();
}

function emptyMessage(text: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.className = 'empty';
  element.textContent = text;
  return element;
}

function formatState(state: string): string {
  return state.replaceAll('-', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function writeOutput(text: string): void {
  if (output) output.textContent = text || 'No command output.';
}

function appendOutput(text: string): void {
  if (output) output.textContent = `${output.textContent === 'Ready.' ? '' : output.textContent}${text}`;
  if (output) output.scrollTop = output.scrollHeight;
}

function postToHost(message: unknown): void {
  if (!desktopApi) {
    const messageText = 'The Podman Desktop host bridge is unavailable. Open this dashboard from the installed extension.';
    if (statusSummary) statusSummary.textContent = messageText;
    writeOutput(messageText);
    if (statusDot) statusDot.className = 'status-dot error';
    return;
  }
  desktopApi.postMessage(message);
}

function closePahTokenDialog(token?: string): void {
  if (pahTokenDialog) pahTokenDialog.hidden = true;
  if (pahTokenError) pahTokenError.textContent = '';
  if (pahTokenInput) pahTokenInput.value = '';
  postToHost({ type: 'pah-token-response', ...(token === undefined ? {} : { token }) });
}

function showPahTokenDialog(): void {
  if (!pahTokenDialog || !pahTokenInput) return;
  pahTokenDialog.hidden = false;
  pahTokenInput.focus();
}

pahTokenCancel?.addEventListener('click', () => closePahTokenDialog());
pahTokenSave?.addEventListener('click', () => {
  const token = pahTokenInput?.value.trim() ?? '';
  if (!token) {
    if (pahTokenError) pahTokenError.textContent = 'An Offline Token is required.';
    pahTokenInput?.focus();
    return;
  }
  closePahTokenDialog(token);
});

function postAction(action: string, idleStateValue?: boolean): void {
  const label = action === 'trust-ca' ? 'Fix SSL' : action;
  if (statusSummary) statusSummary.textContent = `Running ${label}...`;
  postToHost({ type: 'run', action, idleState: idleStateValue });
}

function addExternalLink(link: HTMLAnchorElement, url: string): void {
  const safeUrl = safeExternalUrl(url);
  // Keep untrusted route data out of the DOM URL sink; navigation is delegated
  // to the extension host after protocol validation.
  link.href = '#';
  link.addEventListener('click', event => {
    event.preventDefault();
    if (safeUrl) postToHost({ type: 'open-url', url: safeUrl });
  });
}

if (runtimeManualGuide) {
  addExternalLink(runtimeManualGuide, 'https://nodejs.org/en/download/');
}

function renderRoutes(status: AapDemoStatus): void {
  clear(routes);
  if (!routes || status.routes.length === 0) {
    routes?.append(emptyMessage('No routes available.'));
    return;
  }
  for (const route of status.routes) {
    const row = document.createElement('div');
    row.className = 'list-row';
    const link = document.createElement('a');
    addExternalLink(link, route);
    link.textContent = route;
    row.append(link);
    routes.append(row);
  }
}

function renderCredentials(status: AapDemoStatus): void {
  clear(credentials);
  if (!credentials || status.credentials.length === 0) {
    credentials?.append(emptyMessage('No credentials available.'));
    return;
  }
  for (const credential of status.credentials) {
    const row = document.createElement('div');
    row.className = 'list-row';
    const label = document.createElement('span');
    label.textContent = `${credential.namespace} / ${credential.username}`;
    const password = document.createElement('input');
    password.type = 'password';
    password.value = credential.password;
    password.readOnly = true;
    password.className = 'credential-password';
    password.setAttribute('aria-label', `${credential.namespace} password`);
    const reveal = document.createElement('button');
    reveal.className = 'small';
    reveal.textContent = 'Show';
    reveal.addEventListener('click', () => {
      const visible = password.type === 'text';
      password.type = visible ? 'password' : 'text';
      reveal.textContent = visible ? 'Show' : 'Hide';
    });
    const copy = document.createElement('button');
    copy.className = 'small';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      let copied = false;
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(credential.password);
          copied = true;
        }
      } catch {
        copied = false;
      }
      if (!copied) {
        const copyBuffer = document.createElement('textarea');
        copyBuffer.value = credential.password;
        copyBuffer.setAttribute('readonly', '');
        copyBuffer.style.position = 'fixed';
        copyBuffer.style.opacity = '0';
        document.body.append(copyBuffer);
        copyBuffer.select();
        copied = document.execCommand('copy');
        copyBuffer.remove();
      }
      copy.textContent = copied ? 'Copied' : 'Copy failed';
      window.setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
    });
    const value = document.createElement('span');
    value.append(password, reveal, copy);
    row.append(label, value);
    credentials.append(row);
  }
}

function renderAddons(status: AapDemoStatus): void {
  clear(addonActions);
  if (!addonActions || status.addons.length === 0) {
    addonActions?.append(emptyMessage('No add-on actions available.'));
    return;
  }
  for (const addon of renderableAddons(status.addons)) {
    if (addon.name.toLowerCase() === 'ao' && addon.state === 'disabled') {
      const control = document.createElement('div');
      control.className = 'addon-control ao-provider-actions';
      const choices = [
        { label: 'AO with OpenAI', provider: 'external' },
        { label: 'AO with Ollama', provider: 'ollama' },
        { label: 'AO no AI', provider: 'none' },
      ] as const;
      for (const choice of choices) {
        const button = document.createElement('button');
        button.className = 'small primary';
        button.textContent = choice.label;
        button.addEventListener('click', () => {
          control.querySelectorAll('button').forEach(item => { item.disabled = true; });
          button.textContent = `Enabling ${choice.label}...`;
          if (statusSummary) statusSummary.textContent = `Enabling ${choice.label}...`;
          postToHost({
            type: 'addon',
            action: 'enable',
            addon: 'ao',
            llmProvider: choice.provider,
          });
        });
        control.append(button);
      }
      addonActions.append(control);
      continue;
    }

    const presentation = getAddonTogglePresentation(addon.name, addon.state);
    if (presentation) {
      const control = document.createElement('div');
      control.className = 'addon-control';
      const button = document.createElement('button');
      button.className = presentation.className;
      button.textContent = presentation.label;
      button.setAttribute('aria-label', presentation.ariaLabel);
      button.addEventListener('click', () => {
        button.disabled = true;
        button.textContent = `${presentation.label}...`;
        postToHost({ type: 'addon', action: presentation.action, addon: addon.name });
      });
      control.append(button);
      addonActions.append(control);
    }
  }
  if (!addonActions.childElementCount) addonActions.append(emptyMessage('No add-on actions available.'));
}

function renderStatus(status: AapDemoStatus): void {
  const state = formatState(status.cluster.state);
  if (statusState) statusState.textContent = state;
  if (statusDot) statusDot.className = `status-dot ${status.cluster.state}`;
  if (statusSummary) {
    const clusterName = status.cluster.name ? ` (${status.cluster.name})` : '';
    statusSummary.textContent = `${status.infra ?? 'Infrastructure unknown'}${clusterName}`;
  }
  if (lastUpdated) lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  if (infra) infra.textContent = `Infrastructure: ${status.infra ?? 'unknown'}`;
  if (kubeconfig) kubeconfig.textContent = `Kubeconfig: ${status.kubeconfig ?? 'unknown'}`;
  if (toolVersion) toolVersion.textContent = `CLI: ${status.toolVersion ?? 'unknown'}`;
  renderRoutes(status);
  renderCredentials(status);
  if (fixSslButton) fixSslButton.hidden = !shouldShowFixSsl(status);
  renderAddons(status);
}

function renderPrerequisites(prerequisites: PrerequisiteStatus): void {
  clear(prerequisiteList);
  if (!prerequisiteList) return;
  const checks = [
    {
      label: 'aap-demo CLI',
      valid: prerequisites.cli.available,
      detail: prerequisites.cli.path ?? 'Not installed',
      helpText: undefined,
      helpUrl: undefined,
      actionLabel: undefined,
    },
    {
      label: 'CPUs',
      valid: prerequisites.cpus.valid,
      detail: `${prerequisites.cpus.value} (minimum ${prerequisites.cpus.minimum})`,
      helpText: undefined,
      helpUrl: undefined,
      actionLabel: undefined,
    },
    {
      label: 'OpenShift Local (CRC)',
      valid: prerequisites.crc.available,
      detail: prerequisites.crc.available
        ? prerequisites.crc.path ?? 'Managed by Podman Desktop'
        : 'Not detected. If already installed, set aap-demo.crcPath.',
      helpText: undefined,
      helpUrl: undefined,
      actionLabel: prerequisites.crc.available ? undefined : 'Install with Podman Desktop',
    },
    {
      label: 'Pull secret',
      valid: prerequisites.pullSecret.exists,
      detail: prerequisites.pullSecret.path ?? 'Set aap-demo.pullSecretPath in settings',
      helpText: undefined,
      helpUrl: undefined,
      actionLabel: undefined,
    },
    {
      label: 'Memory',
      valid: prerequisites.memory.valid,
      detail: `${prerequisites.memory.value} MiB (minimum ${prerequisites.memory.minimum} MiB)`,
      helpText: undefined,
      helpUrl: undefined,
      actionLabel: undefined,
    },
  ];
  for (const check of checks) {
    const row = document.createElement('div');
    row.className = `prerequisite ${check.valid ? 'ready' : 'failed'}`;
    const label = document.createElement('strong');
    label.textContent = `${check.valid ? '✓' : '!'} ${check.label}`;
    const detail = document.createElement('span');
    detail.className = 'muted';
    detail.textContent = check.detail;
    row.append(label, detail);
    if (check.helpText) {
      const help = document.createElement('span');
      help.className = 'muted prerequisite-help';
      help.textContent = check.helpText;
      if (check.helpUrl) {
        const guide = document.createElement('a');
        addExternalLink(guide, check.helpUrl);
        guide.textContent = ' Open install guide';
        help.append(guide);
      }
      row.append(help);
    }
    if (check.actionLabel) {
      const install = document.createElement('button');
      install.className = 'small primary prerequisite-action';
      install.type = 'button';
      install.textContent = check.actionLabel;
      install.title = 'Install with Podman Desktop';
      install.addEventListener('click', () => {
        postToHost({ type: 'open-crc-extension' });
      });
      row.append(install);
    }
    prerequisiteList.append(row);
  }
  if (installCli) {
    installCli.hidden = prerequisites.cli.available && prerequisites.installScript.available;
    installCli.disabled = false;
    installCli.title = 'Clone or reuse the aap-demo source and run install.sh';
  }
  if (updateCli) {
    updateCli.hidden = !prerequisites.cli.available || !prerequisites.installScript.available;
    updateCli.disabled = false;
    updateCli.title = 'Pull the latest aap-demo checkout and run install.sh';
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action) postAction(action);
  });
}

idleToggle?.addEventListener('click', () => {
  postAction('idle', idleState);
  idleState = !idleState;
  idleToggle.textContent = idleState ? 'Set idle' : 'Wake AAP';
});

installCli?.addEventListener('click', () => {
  if (statusSummary) statusSummary.textContent = 'Running install.sh...';
  postToHost({ type: 'install-cli' });
});

updateCli?.addEventListener('click', () => {
  if (statusSummary) statusSummary.textContent = 'Updating aap-demo...';
  updateCli.disabled = true;
  postToHost({ type: 'update-cli' });
});

setupExtension?.addEventListener('click', () => {
  if (statusSummary) statusSummary.textContent = 'Setting up local extension updates...';
  setupExtension.disabled = true;
  postToHost({ type: 'setup-extension' });
});

updateExtension?.addEventListener('click', () => {
  if (statusSummary) statusSummary.textContent = 'Updating extension from the local clone...';
  updateExtension.disabled = true;
  postToHost({ type: 'update-extension' });
});

installRuntime?.addEventListener('click', () => {
  if (runtimeMessage) {
    runtimeMessage.textContent = 'Opening a terminal to install the required software. Complete the install there, then return and choose Check again.';
  }
  installRuntime.disabled = true;
  postToHost({ type: 'install-runtime' });
});

checkRuntime?.addEventListener('click', () => {
  if (runtimeMessage) runtimeMessage.textContent = 'Checking Node.js and npm...';
  checkRuntime.disabled = true;
  postToHost({ type: 'check-runtime' });
});

window.addEventListener('message', event => {
  const message = unwrapDashboardMessage(event.data) as DashboardStatusMessage | DashboardPrerequisitesMessage | DashboardExtensionMessage | DashboardRuntimeRequiredMessage | DashboardRuntimeInstallUnavailableMessage | DashboardRuntimeTerminalOpenedMessage | DashboardExtensionSetupCompleteMessage | DashboardPahTokenRequestMessage | DashboardCommandMessage | DashboardCliMessage;
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
  if (message.type === 'pah-token-request') {
    showPahTokenDialog();
    return;
  }
  if (message.type === 'cli-missing') {
    handleCliMissing(
      { statusState, statusDot, statusSummary, toolVersion, installCli, updateCli },
      writeOutput,
    );
    return;
  }
  if (message.type === 'prerequisites') {
    renderPrerequisites(message.prerequisites);
    return;
  }
  if (message.type === 'status') {
    renderStatus(message.status);
    return;
  }
  if (message.type === 'extension-update-available') {
    if (updateExtension) updateExtension.hidden = !message.available;
    if (setupExtension) setupExtension.hidden = !message.setupAvailable;
    return;
  }
  if (message.type === 'runtime-required') {
    if (runtimeHelp) runtimeHelp.hidden = false;
    if (runtimeMessage) {
      const managerInstruction = message.installAvailable
          ? message.reason === 'outdated'
            ? ` Select Install with ${message.packageManager} to try updating the runtime. If it still provides a Node.js version below 24, use the manual installation instructions and choose Check again. If you restart Podman Desktop first, start the setup or update action again afterward.`
            : ` This local extension requires Node.js 24 or newer and npm. Select Install with ${message.packageManager} to continue.`
          : ' This local extension requires Node.js 24 or newer and npm. Install them and choose Check again. If you restart Podman Desktop first, start the setup or update action again afterward.';
      runtimeMessage.textContent = `${message.message}${managerInstruction}`;
    }
    if (installRuntime) {
      installRuntime.hidden = !message.installAvailable;
      installRuntime.disabled = false;
      installRuntime.textContent = message.packageManager
        ? `Install with ${message.packageManager}`
        : 'Install runtime';
    }
    if (checkRuntime) {
      checkRuntime.hidden = false;
      checkRuntime.disabled = false;
    }
    if (runtimeManualGuide) runtimeManualGuide.hidden = false;
    if (runtimeManualGuide) {
      runtimeManualGuide.href = 'https://nodejs.org/en/download/';
      runtimeManualGuide.textContent = 'Node.js installation instructions';
    }
    if (statusSummary) {
      statusSummary.textContent = 'The local extension needs Node.js and npm.';
    }
    return;
  }
  if (message.type === 'runtime-install-unavailable') {
    if (runtimeHelp) runtimeHelp.hidden = false;
    if (runtimeMessage) runtimeMessage.textContent = message.message;
    if (installRuntime) installRuntime.hidden = true;
    if (checkRuntime) {
      checkRuntime.hidden = false;
      checkRuntime.disabled = false;
    }
    if (runtimeManualGuide) runtimeManualGuide.hidden = false;
    return;
  }
  if (message.type === 'runtime-terminal-opened') {
    if (runtimeHelp) runtimeHelp.hidden = false;
    if (runtimeMessage) {
      runtimeMessage.textContent = `A terminal opened for ${message.packageManager}. Complete the install there, then return and choose Check again. If the runtime is still not detected after restarting Podman Desktop, start the setup or update action again.`;
    }
    if (installRuntime) installRuntime.disabled = true;
    if (checkRuntime) {
      checkRuntime.hidden = false;
      checkRuntime.disabled = false;
    }
    return;
  }
  if (message.type === 'extension-setup-complete') {
    if (runtimeHelp) runtimeHelp.hidden = true;
    if (setupExtension) setupExtension.disabled = false;
    writeOutput(
      `Local extension source is ready at ${message.path}.\n\nTo switch: in Podman Desktop open Extensions → Installed, remove the custom OCI extension, then open Extensions → Local Extensions and add this checkout. This does not remove the OCI extension automatically.`,
    );
    if (statusSummary) statusSummary.textContent = 'Local extension source is ready; finish the one-time switch in Podman Desktop.';
    return;
  }
  if (message.type === 'command-output') {
    appendOutput(message.text ?? '');
    return;
  }
  if (message.type === 'command-result' || message.type === 'addon-result') {
    writeOutput([message.stdout, message.stderr].filter(Boolean).join('\n'));
    const actionLabel = message.action === 'trust-ca' ? 'Fix SSL' : formatState(message.action ?? 'command');
    if (statusSummary) statusSummary.textContent = `${actionLabel} completed`;
    if (message.action === 'update-cli' && updateCli) updateCli.disabled = false;
    if (message.action === 'update-extension' && updateExtension) {
      updateExtension.disabled = false;
      if (runtimeHelp) runtimeHelp.hidden = true;
    }
    return;
  }
  if (message.type === 'command-error') {
    writeOutput(message.message ?? 'Command failed.');
    if (message.action === 'install-cli' && installCli) installCli.disabled = false;
    if (message.action === 'update-cli' && updateCli) updateCli.disabled = false;
    if (message.action === 'setup-extension' || message.action === 'update-extension') {
      if (setupExtension) setupExtension.disabled = false;
      if (updateExtension) updateExtension.disabled = false;
      if (runtimeHelp) runtimeHelp.hidden = true;
    }
    if (message.addon === 'ao') {
      addonActions?.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
    if (statusDot) statusDot.className = 'status-dot error';
    if (statusSummary) {
      const actionLabel = message.action === 'trust-ca' ? 'Fix SSL' : formatState(message.action ?? 'command');
      statusSummary.textContent = `${actionLabel} failed. See command output for recovery steps.`;
    }
  }
});

if (desktopApi) {
  desktopApi.postMessage({ type: 'ready' });
} else {
  postToHost({ type: 'ready' });
}
