import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAddonTogglePresentation, renderableAddons, sortAddons } from '../src/webview/addon-ui';

const dashboardHtml = readFileSync(resolve(__dirname, '../src/webview/index.html'), 'utf8');
const dashboardSource = readFileSync(resolve(__dirname, '../src/webview/dashboard.ts'), 'utf8');
const extensionSource = readFileSync(resolve(__dirname, '../src/extension.ts'), 'utf8');
const packageJson = readFileSync(resolve(__dirname, '../package.json'), 'utf8');
const containerfile = readFileSync(resolve(__dirname, '../Containerfile'), 'utf8');
const readme = readFileSync(resolve(__dirname, '../README.md'), 'utf8');

describe('getAddonTogglePresentation', () => {
  it('uses a green enabled toggle that disables the add-on when clicked', () => {
    expect(getAddonTogglePresentation('fleet', 'enabled')).toEqual({
      className: 'addon-toggle enabled',
      action: 'disable',
      label: 'fleet',
      ariaLabel: 'Disable fleet',
    });
  });

  it('uses a red disabled toggle that enables the add-on when clicked', () => {
    expect(getAddonTogglePresentation('fleet', 'disabled')).toEqual({
      className: 'addon-toggle disabled',
      action: 'enable',
      label: 'fleet',
      ariaLabel: 'Enable fleet',
    });
  });

  it('labels the portal operator add-on as amd64 only without changing its command name', () => {
    expect(getAddonTogglePresentation('portal', 'disabled')).toEqual({
      className: 'addon-toggle disabled',
      action: 'enable',
      label: 'portal operator (amd64 only)',
      ariaLabel: 'Enable portal operator (amd64 only)',
    });
  });

  it('does not offer a toggle for an unknown state', () => {
    expect(getAddonTogglePresentation('fleet', 'unknown')).toBeUndefined();
  });

  it('sorts add-ons alphabetically without mutating the status array', () => {
    const addons = [{ name: 'portal' }, { name: 'ao' }, { name: 'fleet' }];

    expect(sortAddons(addons).map(addon => addon.name)).toEqual(['ao', 'fleet', 'portal']);
    expect(addons.map(addon => addon.name)).toEqual(['portal', 'ao', 'fleet']);
  });

  it('does not render add-ons hidden from the Podman Desktop dashboard', () => {
    const addons = [
      { name: 'portal' },
      { name: 'product-demo-satellite' },
      { name: 'local-cache' },
      { name: 'fleet' },
      { name: 'mcp-server' },
    ];

    expect(renderableAddons(addons).map(addon => addon.name)).toEqual(['mcp-server', 'portal']);
    expect(addons.map(addon => addon.name)).toEqual([
      'portal',
      'product-demo-satellite',
      'local-cache',
      'fleet',
      'mcp-server',
    ]);
  });

  it('keeps detailed add-on descriptions out of the dashboard page', () => {
    expect(dashboardHtml).toContain('<h2>Addons <span class="heading-note">(green means enabled and grey means disabled)</span></h2>');
    expect(dashboardHtml).not.toContain('<p class="muted">green means enabled and grey means disabled</p>');
    expect(dashboardHtml).not.toContain('Optional capabilities for the local AAP environment.');
    expect(dashboardHtml).not.toContain('Automation Orchestrator using an OpenAI-compatible provider');
    expect(dashboardHtml).not.toContain('MCP server');
    expect(dashboardHtml).not.toContain('portal operator (amd64 only)</strong>');
    expect(dashboardHtml).not.toContain('Add-on actions');
  });

  it('keeps prerequisites inside the Status card', () => {
    const statusStart = dashboardHtml.indexOf('<div class="status" id="status">');
    const statusEnd = dashboardHtml.indexOf('<div class="actions">', statusStart);

    expect(dashboardHtml.slice(statusStart, statusEnd)).toContain('<h2>Status</h2>');
    expect(dashboardHtml.slice(statusStart, statusEnd)).toContain('id="prerequisite-list"');
    expect(dashboardHtml).not.toContain('<h3>Prerequisites</h3>');
    expect(dashboardHtml).not.toContain('<section class="card" id="prerequisites">');
  });

  it('offers the install script when the aap-demo CLI is unavailable', () => {
    expect(dashboardHtml).toContain('id="install-cli"');
    expect(dashboardHtml).toContain('Install aap-demo');
    expect(dashboardHtml).toContain('id="update-cli"');
    expect(dashboardHtml).toContain('Update aap-demo');
    expect(dashboardHtml).toContain('id="update-extension"');
    expect(dashboardHtml).toContain('Update extension');
  });

  it('restores the CLI install button when installation fails', () => {
    expect(dashboardSource).toContain("message.action === 'install-cli' && installCli");
    expect(dashboardSource).toContain('installCli.disabled = false');
  });

  it('keeps Install aap-demo visible when the source is missing', () => {
    expect(dashboardSource).toContain(
      'installCli.hidden = prerequisites.cli.available && prerequisites.installScript.available',
    );
  });

  it('offers local extension setup and runtime recovery actions', () => {
    expect(dashboardHtml).toContain('id="setup-extension"');
    expect(dashboardHtml).toContain('id="install-runtime"');
    expect(dashboardHtml).toContain('id="check-runtime"');
    expect(dashboardSource).toContain("type: 'setup-extension'");
    expect(dashboardSource).toContain("type: 'install-runtime'");
    expect(dashboardSource).toContain("type: 'check-runtime'");
    expect(extensionSource).toContain("message.type === 'setup-extension'");
    expect(extensionSource).toContain("message.type === 'install-runtime'");
    expect(extensionSource).toContain("message.type === 'check-runtime'");
  });

  it('explains the one-time OCI-to-local extension switch after setup', () => {
    expect(dashboardSource).toContain("message.type === 'extension-setup-complete'");
    expect(dashboardSource).toContain('Extensions → Local Extensions');
    expect(dashboardSource).toContain('does not remove the OCI extension');
  });

  it('shows Node.js/npm install guidance and a re-check action', () => {
    expect(dashboardSource).toContain("message.type === 'runtime-required'");
    expect(dashboardSource).toContain("message.type === 'runtime-install-unavailable'");
    expect(dashboardSource).toContain("message.reason === 'outdated'");
    expect(dashboardSource).toContain('runtimeManualGuide.hidden = false');
    expect(dashboardSource).toContain("addExternalLink(runtimeManualGuide, 'https://nodejs.org/en/download/')");
    expect(dashboardSource).toContain('Check again');
    expect(dashboardSource).toContain('Node.js 24 or newer');
  });

  it('documents Git as a prerequisite for local setup', () => {
    expect(readme).toContain('winget install --id Git.Git -e');
    expect(extensionSource).toContain("verifyTool('git')");
  });

  it('tells users to restart the source action if the extension host restarted', () => {
    expect(dashboardSource).toContain('start the setup or update action again');
    expect(dashboardSource).toContain("message.action === 'setup-extension' || message.action === 'update-extension'");
  });

  it('explains how to install OpenShift Local from the Podman Desktop catalog', () => {
    expect(dashboardSource).toContain("type: 'open-crc-extension'");
    expect(dashboardSource).toContain('Install with Podman Desktop');
    expect(dashboardSource).toContain('follow its prompts to install the extension and CRC binaries');
    expect(dashboardSource).toContain('https://podman-desktop.io/docs/openshift/openshift-local');
    expect(extensionSource).toContain("message.type === 'open-crc-extension'");
    expect(extensionSource).toContain('podman-desktop:extension/redhat.openshift-local');
    expect(extensionSource).toContain('Extensions → Catalog and search for OpenShift Local');
    const crcCheck = extensionSource.slice(
      extensionSource.indexOf('async function checkCrc'),
      extensionSource.indexOf('export async function activate'),
    );
    expect(crcCheck).not.toContain('showWarningMessage');
  });

  it('handles update requests through the extension host', () => {
    expect(extensionSource).toContain("message.type === 'update-cli'");
    expect(extensionSource).toContain("registerCommand('aap-demo.updateCli'");
    expect(extensionSource).toContain("message.type === 'update-extension'");
    expect(extensionSource).toContain("registerCommand('aap-demo.updateExtension'");
  });

  it('renders prerequisites before checking CLI status', () => {
    const initializer = extensionSource.slice(
      extensionSource.indexOf('const initializeDashboard'),
      extensionSource.indexOf('const messageSubscription'),
    );

    expect(initializer.indexOf("type: 'prerequisites'")).toBeLessThan(
      initializer.indexOf("runAction('status')"),
    );
  });

  it('rechecks prerequisites after a status refresh', () => {
    const statusAction = extensionSource.slice(
      extensionSource.indexOf("if (action === 'status')"),
      extensionSource.indexOf("type: 'command-result'", extensionSource.indexOf("if (action === 'status')")),
    );

    expect(statusAction).toContain('await refreshPrerequisites()');
  });

  it('places start and stop controls beside Deploy AAP', () => {
    const actionsStart = dashboardHtml.indexOf('<div class="actions">');
    const actionsEnd = dashboardHtml.indexOf('</div>', actionsStart);
    const actionRow = dashboardHtml.slice(actionsStart, actionsEnd);

    expect(actionRow).toContain('data-action="start"');
    expect(actionRow).toContain('>Start</button>');
    expect(actionRow).toContain('data-action="stop"');
    expect(actionRow).toContain('>Stop</button>');
  });

  it('shows the Ansible Automation Platform logo in the dashboard header', () => {
    expect(dashboardHtml).toContain('<img src="./assets/ansible-logo.png" alt="Ansible Automation Platform logo"');
  });

  it('does not expose a broken extension details link from the dashboard', () => {
    expect(dashboardHtml).not.toContain('id="readme-link"');
    expect(dashboardHtml).not.toContain('Documentation');
    expect(dashboardSource).not.toContain('open-extension-info');
    expect(extensionSource).not.toContain('open-extension-info');
  });

  it('keeps the primary lifecycle actions ordered beside Deploy AAP without duplicating status', () => {
    const actionsStart = dashboardHtml.indexOf('<div class="actions">');
    const actionsEnd = dashboardHtml.indexOf('</div>', actionsStart);
    const actionRow = dashboardHtml.slice(actionsStart, actionsEnd);

    expect(actionRow).not.toContain('data-action="create"');
    expect(actionRow).not.toContain('data-action="status"');
    expect(actionRow).toContain('<button class="primary" data-action="start">Start</button>');
    expect(actionRow).toContain('<button class="primary" data-action="diagnose">Diagnose</button>');
    expect(actionRow).toContain('<button class="primary" id="idle-toggle">Set idle</button>');
    expect(actionRow.indexOf('data-action="deploy"')).toBeLessThan(actionRow.indexOf('data-action="start"'));
  });

  it('declares and packages the extension icon for Podman Desktop', () => {
    expect(packageJson).toContain('"icon": "icon.png"');
    expect(packageJson).toContain('"activationEvents": ["onStartupFinished"]');
    expect(containerfile).toContain('COPY icon.png /extension/icon.png');
  });

  it('packages the README shown in extension details', () => {
    expect(containerfile).toContain(
      'COPY --from=build /extension-source/README.md /extension/README.md',
    );
  });

  it('keeps repository development instructions out of extension details', () => {
    expect(readme).not.toContain('## Development');
    expect(readme).not.toContain('npm run typecheck');
    expect(readme).not.toContain('TESTING.md');
    expect(readme).toContain('## Troubleshooting');
  });

  it('documents what each add-on does in extension details', () => {
    expect(readme).toContain('## Add-ons');
    expect(readme).toContain('AO with OpenAI');
    expect(readme).toContain('AO with Ollama');
    expect(readme).toContain('AO no AI');
    expect(readme).toContain('MCP server');
    expect(readme).toContain('portal operator (amd64 only)');
  });

  it('declares the configurable aap-demo repository install location', () => {
    const manifest = JSON.parse(packageJson);
    const installLocation = manifest.contributes.configuration.properties['aap-demo.installLocation'];
    expect(installLocation.default).toBe('~/.aap-demo/aap-demo');
    expect(installLocation.description).toContain('CLI data under ~/.aap-demo');
  });

  it('sets the OpenShift Local CPU minimum to eight in Podman Desktop settings', () => {
    const manifest = JSON.parse(packageJson);
    expect(manifest.contributes.configuration.properties['aap-demo.cpus'].minimum).toBe(8);
  });

  it('declares a separate local extension source checkout setting', () => {
    expect(packageJson).toContain('"aap-demo.extensionInstallLocation"');
    expect(packageJson).toContain('"default": "~/.aap-demo-podman-desktop-extension"');
  });

  it('adds space below the Addons section', () => {
    expect(dashboardHtml).toContain('.addons-card { margin-bottom: 14px; }');
    expect(dashboardHtml).toContain('<section class="card addons-card">');
  });

  it('keeps credential passwords in a readonly input while toggling visibility', () => {
    expect(dashboardSource).toContain("document.createElement('input')");
    expect(dashboardSource).toContain("password.type = 'password'");
    expect(dashboardSource).toContain("password.value = credential.password");
    expect(dashboardSource).toContain("password.type = visible ? 'password' : 'text'");
  });

  it('copies credentials with a browser clipboard fallback', () => {
    expect(dashboardSource).toContain('navigator.clipboard.writeText(credential.password)');
    expect(dashboardSource).toContain('document.execCommand(\'copy\')');
    expect(dashboardSource).toContain("copied ? 'Copied' : 'Copy failed'");
  });

  it('reuses the saved OpenAI key through the CLI environment', () => {
    expect(extensionSource).toContain("readFileSync(aoLlmApiKeyFile, 'utf8')");
    expect(extensionSource).toContain('process.env.OPENAI_API_KEY?.trim() || readSavedAoOpenAiKey()');
    expect(extensionSource).toContain('addonEnvironment.OPENAI_API_KEY = openAiApiKey');
  });
});
