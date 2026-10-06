import * as fs from 'node:fs/promises';
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ExtensionContext, WebviewPanel } from '@podman-desktop/api';
import * as extensionApi from '@podman-desktop/api';
import {
  AapDemoService,
  type AddonAction,
  type AapDemoAction,
  type AapDemoSettings,
} from './aap-demo-service';
import { formatCommandError } from './command-error';
import { getCliCheckoutAction } from './cli-checkout';
import { CommandRunner } from './command-runner';
import { detectCliVersion } from './cli-version';
import { isDashboardMessage, type AoLlmProvider } from './dashboard-protocol';
import { augmentPath, resolveConfiguredExecutable, resolveExecutablePath } from './executable-path';
import { isLocalExtensionCheckout } from './extension-updater';
import { ExtensionSourceService, MissingRuntimeError } from './extension-source-service';
import { resolveExtensionInstallLocation } from './extension-source';
import { getRuntimeInstallPlan, launchRuntimeInstall } from './runtime-installer';
import { checkPrerequisites } from './prerequisites';
import {
  AAP_DEMO_REPOSITORY_URL,
  installScriptPathFor,
  resolveInstallLocation,
} from './install-script';
import { parseStatusOutput } from './status-parser';
import { formatStatusBarText } from './status-bar';

async function renderWebviewHtml(
  panel: WebviewPanel,
  extensionContext: ExtensionContext,
): Promise<string> {
  const htmlPath = path.join(extensionContext.extensionUri.fsPath, 'media', 'index.html');
  let html = await fs.readFile(htmlPath, 'utf8');
  const resourcePattern = /(src|href)="(\.\/[^\"]+)"/g;

  html = html.replace(resourcePattern, (_match, attribute: string, resourcePath: string) => {
    const localPath = resourcePath.slice(2);
    const resourceUri = extensionApi.Uri.joinPath(
      extensionContext.extensionUri,
      'media',
      ...localPath.split('/'),
    );
    return `${attribute}="${panel.webview.asWebviewUri(resourceUri)}"`;
  });

  return html;
}

async function checkCrc(crcCommand: string): Promise<void> {
  const crcPath = resolveExecutablePath(crcCommand);
  if (!crcPath) {
    console.warn('[aap-demo] OpenShift Local (CRC) was not detected; see the Status card for the Podman Desktop install action.');
    return;
  }

  console.log(`[aap-demo] OpenShift Local found at ${crcPath}`);
}

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const runner = new CommandRunner();
  const extensionPath = extensionContext.extensionUri.fsPath;
  const localExtensionCheckout = isLocalExtensionCheckout(extensionPath);
  const configuration = extensionApi.configuration.getConfiguration('aap-demo');
  const configuredCliPath = configuration.get('cliPath', 'aap-demo').trim() || 'aap-demo';
  const cliPath = resolveConfiguredExecutable(configuredCliPath);
  const installLocationSetting = configuration.get('installLocation', '~/.aap-demo');
  const extensionInstallLocationSetting = configuration.get(
    'extensionInstallLocation',
    '~/.aap-demo-podman-desktop-extension',
  );
  const extensionInstallLocation = resolveExtensionInstallLocation(extensionInstallLocationSetting);
  const aoLlmModel = configuration.get('aoLlmModel', 'gpt-5.6-luna').trim() || 'gpt-5.6-luna';
  const aoLlmBaseUrl = configuration.get('aoLlmBaseUrl', 'https://api.openai.com/v1').trim() || 'https://api.openai.com/v1';
  const configuredAoLlmApiKeyFile = configuration.get('aoLlmApiKeyFile', '').trim();
  const defaultAoLlmApiKeyFile = process.env.AO_LLM_API_KEY_FILE || path.join(
    process.env.AAP_DEMO_DIR || path.join(os.homedir(), '.aap-demo'),
    'ao',
    'llm-api-key',
  );
  const aoLlmApiKeyFileSetting = configuredAoLlmApiKeyFile || defaultAoLlmApiKeyFile;
  const aoLlmApiKeyFile = aoLlmApiKeyFileSetting === '~'
    ? os.homedir()
    : aoLlmApiKeyFileSetting.startsWith('~/') || aoLlmApiKeyFileSetting.startsWith('~\\')
      ? path.join(os.homedir(), aoLlmApiKeyFileSetting.slice(2))
      : aoLlmApiKeyFileSetting;
  const crcPath = configuration.get('crcPath', 'crc');
  const settings: AapDemoSettings = {
    cpus: configuration.get('cpus', 8),
    pullSecretPath: configuration.get('pullSecretPath', ''),
    memory: configuration.get('memory', 24_576),
    pathValue: augmentPath(),
  };
  const service = new AapDemoService(runner, cliPath, settings);
  const cliVersion = await detectCliVersion(runner, cliPath);
  const cliTool = extensionApi.cli.createCliTool({
    name: 'aap-demo',
    displayName: 'AAP Demo CLI',
    markdownDescription: 'The command-line interface for the local AAP Demo environment.',
    images: {},
    version: cliVersion,
    path: cliPath,
  });
  extensionContext.subscriptions.push(cliTool);
  try {
    await configuration.update('cliVersion', cliVersion);
  } catch (error) {
    console.warn('[aap-demo] Could not persist the detected CLI version', error);
  }
  let panel: WebviewPanel | undefined;
  const postDashboardMessage = async (message: unknown): Promise<boolean> => {
    const currentPanel = panel;
    if (!currentPanel) return false;
    const delivered = await currentPanel.webview.postMessage(message);
    if (!delivered) {
      console.warn('[aap-demo] Dashboard webview did not accept a message', message);
    }
    return delivered;
  };
  const refreshPrerequisites = async (): Promise<void> => {
    await postDashboardMessage({
      type: 'prerequisites',
      prerequisites: checkPrerequisites({
        cliPath,
        crcPath,
        installLocation: installLocationSetting,
        ...settings,
      }),
    });
  };
  const statusBar = extensionApi.window.createStatusBarItem(extensionApi.StatusBarAlignLeft, 100);
  statusBar.text = 'AAP Demo: Unknown';
  statusBar.tooltip = 'Open the AAP Demo dashboard';
  statusBar.command = 'aap-demo.openDashboard';
  statusBar.show();
  extensionContext.subscriptions.push(statusBar);

  const runAction = async (action: AapDemoAction, idleState?: boolean): Promise<void> => {
    const actionLabel = action === 'trust-ca' ? 'Fix SSL' : action;
    if (!resolveExecutablePath(configuredCliPath, settings.pathValue)) {
      statusBar.text = 'AAP Demo: CLI missing';
      statusBar.tooltip = 'Install the aap-demo CLI from the dashboard';
      await postDashboardMessage({ type: 'cli-missing' });
      if (!panel && action !== 'status') {
        await extensionApi.window.showWarningMessage(
          'The aap-demo CLI is not installed. Open the AAP Demo dashboard and select Install aap-demo.',
        );
      }
      return;
    }

    try {
      const result = await service.run(action, idleState, {
        onStdout: chunk => {
          console.log(`[aap-demo] ${chunk.trimEnd()}`);
          if (action !== 'status') {
            void postDashboardMessage({ type: 'command-output', stream: 'stdout', text: chunk });
          }
        },
        onStderr: chunk => {
          console.warn(`[aap-demo] ${chunk.trimEnd()}`);
          void postDashboardMessage({ type: 'command-output', stream: 'stderr', text: chunk });
        },
      });

      if (action === 'status') {
        const status = parseStatusOutput(result.stdout);
        statusBar.text = formatStatusBarText(status);
        statusBar.tooltip = `Open the AAP Demo dashboard (${status.cluster.state})`;
        await postDashboardMessage({
          type: 'status',
          status,
        });
        await refreshPrerequisites();
        return;
      }

      await postDashboardMessage({
        type: 'command-result',
        action,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      await extensionApi.window.showInformationMessage(`AAP Demo ${actionLabel} completed.`);
      void runAction('status');
    } catch (error) {
      const message = formatCommandError(error);
      await postDashboardMessage({ type: 'command-error', action, message });
      await extensionApi.window.showWarningMessage(`AAP Demo ${actionLabel} failed: ${message}`);
    }
  };

  const runCliMaintenance = async (mode: 'install' | 'update'): Promise<void> => {
    const action = mode === 'update' ? 'update-cli' : 'install-cli';
    const verb = mode === 'update' ? 'updated' : 'installed';
    const installLocation = resolveInstallLocation(installLocationSetting);
    const installScriptPath = installScriptPathFor(installLocation);
    const streamOptions = {
      env: { ...process.env, PATH: settings.pathValue },
      onStdout: (chunk: string) => {
        console.log(`[aap-demo install] ${chunk.trimEnd()}`);
        void postDashboardMessage({ type: 'command-output', stream: 'stdout', text: chunk });
      },
      onStderr: (chunk: string) => {
        console.warn(`[aap-demo install] ${chunk.trimEnd()}`);
        void postDashboardMessage({ type: 'command-output', stream: 'stderr', text: chunk });
      },
    };
    try {
      const locationExists = existsSync(installLocation);
      const gitMetadataExists = locationExists && existsSync(path.join(installLocation, '.git'));
      const hasAapDemoSource = locationExists
        && existsSync(path.join(installLocation, 'install.sh'))
        && existsSync(path.join(installLocation, 'aap-demo.sh'));
      const locationIsEmpty = locationExists
        && lstatSync(installLocation).isDirectory()
        && readdirSync(installLocation).length === 0;
      const checkoutAction = getCliCheckoutAction(
        mode,
        locationExists,
        gitMetadataExists,
        hasAapDemoSource,
        locationIsEmpty,
      );

      if (checkoutAction === 'missing') {
        throw new Error(
          `aap-demo checkout not found at ${installLocation}. Use Install aap-demo first.`,
        );
      }
      if (checkoutAction === 'not-updatable') {
        throw new Error(
          `The aap-demo source at ${installLocation} can be reused to install, but it is not a Git checkout, so it cannot pull updates. Set aap-demo.installLocation to a Git checkout to use Update.`,
        );
      }
      if (checkoutAction === 'refuse') {
        throw new Error(
          `Install location already exists and is not a recognizable aap-demo source or Git checkout: ${installLocation}. The folder was left unchanged. Set aap-demo.installLocation to another directory.`,
        );
      }
      if (checkoutAction === 'pull') {
        await runner.run('git', ['-C', installLocation, 'pull', '--ff-only'], streamOptions);
      } else if (checkoutAction === 'clone') {
        await runner.run('git', ['clone', AAP_DEMO_REPOSITORY_URL, installLocation], streamOptions);
      }
      const result = await runner.run('bash', [installScriptPath], {
        cwd: path.dirname(installScriptPath),
        ...streamOptions,
      });
      await postDashboardMessage({ type: 'command-result', action, stdout: result.stdout, stderr: result.stderr });
      await extensionApi.window.showInformationMessage(`aap-demo ${verb}. Refreshing status.`);
      await runAction('status');
    } catch (error) {
      const message = formatCommandError(error);
      await postDashboardMessage({ type: 'command-error', action, message });
      await extensionApi.window.showWarningMessage(`aap-demo ${mode} failed: ${message}`);
    }
  };

  const runInstall = async (): Promise<void> => runCliMaintenance('install');
  const runUpdate = async (): Promise<void> => runCliMaintenance('update');

  type ExtensionSourceOperation = 'setup-extension' | 'update-extension';
  let pendingExtensionSourceOperation: ExtensionSourceOperation | undefined;
  const sourceStreamOptions = (action: ExtensionSourceOperation) => ({
    onStdout: (chunk: string) => {
      console.log(`[aap-demo ${action}] ${chunk.trimEnd()}`);
      void postDashboardMessage({ type: 'command-output', stream: 'stdout', text: chunk });
    },
    onStderr: (chunk: string) => {
      console.warn(`[aap-demo ${action}] ${chunk.trimEnd()}`);
      void postDashboardMessage({ type: 'command-output', stream: 'stderr', text: chunk });
    },
  });

  const runExtensionSourceOperation = async (
    action: ExtensionSourceOperation,
  ): Promise<void> => {
    try {
      if (action === 'update-extension' && !localExtensionCheckout) {
        throw new Error(
          'This extension is not running from a local Git checkout. Add the cloned repository under Extensions → Local Extensions first.',
        );
      }
      const checkoutPath = action === 'update-extension' ? extensionPath : extensionInstallLocation;
      const sourceService = new ExtensionSourceService(runner, {
        checkoutPath,
        pathValue: settings.pathValue ?? '',
        pathExists: candidate => existsSync(candidate),
        gitMetadataExists: candidate => existsSync(path.join(candidate, '.git')),
      });
      const result = await sourceService.prepare(sourceStreamOptions(action));
      if (action === 'setup-extension') {
        pendingExtensionSourceOperation = undefined;
        await postDashboardMessage({ type: 'command-result', action, stdout: result.stdout, stderr: result.stderr });
        await postDashboardMessage({ type: 'extension-setup-complete', path: checkoutPath });
        await extensionApi.window.showInformationMessage(
          'Local extension source is ready. Add it from Extensions → Local Extensions when you are ready to switch.',
        );
      } else {
        pendingExtensionSourceOperation = undefined;
        await postDashboardMessage({ type: 'command-result', action, stdout: result.stdout, stderr: result.stderr });
        await extensionApi.window.showInformationMessage(
          'Extension updated from the local clone. Stop and start the local extension, then reopen the dashboard.',
        );
      }
    } catch (error) {
      if (error instanceof MissingRuntimeError) {
        pendingExtensionSourceOperation = action;
        const installPlan = getRuntimeInstallPlan(settings.pathValue);
        const installAvailable = installPlan.status === 'ready';
        await postDashboardMessage({
          type: 'runtime-required',
          runtime: error.runtime,
          reason: error.reason,
          message: error.message,
          installAvailable,
          ...(installPlan.status === 'ready' ? { packageManager: installPlan.packageManager } : {}),
        });
        return;
      }
      pendingExtensionSourceOperation = undefined;
      const message = formatCommandError(error);
      await postDashboardMessage({ type: 'command-error', action, message });
      await extensionApi.window.showWarningMessage(`Extension ${action === 'setup-extension' ? 'setup' : 'update'} failed: ${message}`);
    }
  };

  const runExtensionUpdate = async (): Promise<void> => {
    await runExtensionSourceOperation('update-extension');
  };

  const runExtensionSetup = async (): Promise<void> => {
    await runExtensionSourceOperation('setup-extension');
  };

  const installExtensionRuntime = async (): Promise<void> => {
    const plan = getRuntimeInstallPlan(settings.pathValue);
    if (plan.status !== 'ready') {
      await postDashboardMessage({
        type: 'runtime-install-unavailable',
        message: plan.status === 'package-manager-missing'
          ? `Could not find ${plan.packageManager}. Install Node.js 24 or newer and npm manually. If you restart Podman Desktop, start the setup or update action again.`
          : 'Automatic runtime installation is only offered for RHEL derivatives, macOS with Homebrew, and Windows with WinGet. Install Node.js 24 or newer and npm manually. If you restart Podman Desktop, start the setup or update action again.',
      });
      return;
    }
    try {
      await launchRuntimeInstall(plan, undefined, settings.pathValue);
      await postDashboardMessage({ type: 'runtime-terminal-opened', packageManager: plan.packageManager });
    } catch (error) {
      await postDashboardMessage({
        type: 'runtime-install-unavailable',
        message: `${formatCommandError(error)} Install Node.js 24 or newer and npm manually. If you restart Podman Desktop, start the setup or update action again.`,
      });
    }
  };

  const checkExtensionRuntime = async (): Promise<void> => {
    if (!pendingExtensionSourceOperation) {
      await postDashboardMessage({
        type: 'runtime-install-unavailable',
        message: 'There is no pending local extension setup or update. Start that action again after installing Node.js and npm.',
      });
      return;
    }
    await runExtensionSourceOperation(pendingExtensionSourceOperation);
  };

  const hasSavedAoOpenAiKey = (): boolean => {
    try {
      const keyStats = lstatSync(aoLlmApiKeyFile);
      return keyStats.isFile() && !keyStats.isSymbolicLink() && keyStats.size > 0;
    } catch {
      return false;
    }
  };

  const runAddon = async (
    action: AddonAction,
    addon: string,
    llmProvider?: AoLlmProvider,
  ): Promise<void> => {
    try {
      let openAiApiKey = process.env.OPENAI_API_KEY;
      if (
        action === 'enable' && addon === 'ao' && llmProvider === 'external' &&
        !openAiApiKey && !hasSavedAoOpenAiKey()
      ) {
        const enteredKey = await extensionApi.window.showInputBox({
          title: 'AO with OpenAI',
          prompt: 'Enter the OpenAI API key. aap-demo saves it locally with restricted file permissions.',
          password: true,
          ignoreFocusOut: true,
          placeHolder: 'OpenAI API key',
          validateInput: value => value.trim() ? undefined : 'An API key is required.',
        });
        if (enteredKey === undefined) {
          await runAction('status');
          return;
        }
        openAiApiKey = enteredKey.trim();
      }

      const addonEnvironment: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: settings.pathValue,
      };
      if (action === 'enable' && addon === 'ao' && llmProvider) {
        addonEnvironment.AO_LLM_PROVIDER = llmProvider;
        if (llmProvider === 'external') {
          addonEnvironment.AO_LLM_MODEL = aoLlmModel;
          addonEnvironment.AO_LLM_BASE_URL = aoLlmBaseUrl;
          addonEnvironment.AO_LLM_API_KEY_FILE = aoLlmApiKeyFile;
          if (openAiApiKey) addonEnvironment.OPENAI_API_KEY = openAiApiKey;
        }
      }

      const result = await service.runAddon(action, addon, {
        env: addonEnvironment,
        onStdout: chunk => {
          console.log(`[aap-demo] ${chunk.trimEnd()}`);
          void postDashboardMessage({ type: 'command-output', stream: 'stdout', text: chunk });
        },
        onStderr: chunk => {
          console.warn(`[aap-demo] ${chunk.trimEnd()}`);
          void postDashboardMessage({ type: 'command-output', stream: 'stderr', text: chunk });
        },
      });
      await postDashboardMessage({
        type: 'addon-result',
        action,
        addon,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      const providerLabel = llmProvider === 'external'
        ? ' with OpenAI'
        : llmProvider === 'ollama'
          ? ' with Ollama'
          : llmProvider === 'none'
            ? ' with no AI'
            : '';
      await extensionApi.window.showInformationMessage(
        `AAP Demo add-on ${addon}${action === 'enable' ? providerLabel : ''} ${action}d.`,
      );
      await runAction('status');
    } catch (error) {
      const message = formatCommandError(error);
      await postDashboardMessage({ type: 'command-error', action, addon, message });
      await extensionApi.window.showWarningMessage(`AAP Demo add-on ${addon} failed: ${message}`);
      await runAction('status');
    }
  };

  const openDashboard = extensionApi.commands.registerCommand('aap-demo.openDashboard', async () => {
    if (panel) {
      panel.reveal();
      return;
    }

    panel = extensionApi.window.createWebviewPanel('aap-demo.dashboard', 'AAP Demo Dashboard', {
      localResourceRoots: [extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media')],
    });
    let initialized = false;
    let initializationTimer: ReturnType<typeof setTimeout> | undefined;
    const initializeDashboard = async (): Promise<void> => {
      if (initialized) return;
      initialized = true;
      await new Promise(resolve => setTimeout(resolve, 200));
      await postDashboardMessage({
        type: 'extension-update-available',
        available: localExtensionCheckout,
        setupAvailable: !localExtensionCheckout,
      });
      await refreshPrerequisites();
      void runAction('status');
    };
    const messageSubscription = panel.webview.onDidReceiveMessage(async message => {
      if (isDashboardMessage(message)) {
        if (message.type === 'ready') {
          void initializeDashboard();
        } else if (message.type === 'install-cli') {
          await runInstall();
        } else if (message.type === 'update-cli') {
          await runUpdate();
        } else if (message.type === 'update-extension') {
          await runExtensionUpdate();
        } else if (message.type === 'setup-extension') {
          await runExtensionSetup();
        } else if (message.type === 'install-runtime') {
          await installExtensionRuntime();
        } else if (message.type === 'check-runtime') {
          await checkExtensionRuntime();
        } else if (message.type === 'open-crc-extension') {
          const crcExtensionUri = extensionApi.Uri.parse(
            'podman-desktop:extension/redhat.openshift-local',
            true,
          );
          try {
            const opened = await extensionApi.env.openExternal(crcExtensionUri);
            if (!opened) {
              await extensionApi.window.showWarningMessage(
                'Could not open the OpenShift Local extension page. In Podman Desktop, open Extensions → Catalog and search for OpenShift Local, then use its dashboard to install CRC.',
              );
            }
          } catch (error) {
            console.error('[aap-demo] Could not open the OpenShift Local extension page:', error);
            await extensionApi.window.showWarningMessage(
              'Could not open the OpenShift Local extension page. In Podman Desktop, open Extensions → Catalog and search for OpenShift Local, then use its dashboard to install CRC.',
            );
          }
        } else if (message.type === 'addon') {
          await runAddon(message.action, message.addon, message.llmProvider);
        } else if (message.type === 'open-url') {
          const opened = await extensionApi.env.openExternal(extensionApi.Uri.parse(message.url, true));
          if (!opened) {
            await extensionApi.window.showWarningMessage(`Could not open ${message.url}`);
          }
        } else {
          await runAction(message.action, message.idleState);
        }
      }
    });
    panel.webview.html = await renderWebviewHtml(panel, extensionContext);
    initializationTimer = setTimeout(() => void initializeDashboard(), 2_000);
    const statusPoll = setInterval(() => void runAction('status'), 30_000);
    extensionContext.subscriptions.push(
      messageSubscription,
      panel.onDidDispose(() => {
        if (initializationTimer) clearTimeout(initializationTimer);
        clearInterval(statusPoll);
        panel = undefined;
      }),
    );
  });
  extensionContext.subscriptions.push(openDashboard);

  for (const action of ['create', 'start', 'deploy', 'stop', 'destroy', 'status', 'diagnose', 'repair'] as const) {
    extensionContext.subscriptions.push(
      extensionApi.commands.registerCommand(`aap-demo.${action}`, () => runAction(action)),
    );
  }
  extensionContext.subscriptions.push(
    extensionApi.commands.registerCommand(
      'aap-demo.idle',
      (idleState: boolean = true) => runAction('idle', idleState),
    ),
    extensionApi.commands.registerCommand('aap-demo.installCli', () => runInstall()),
    extensionApi.commands.registerCommand('aap-demo.updateCli', () => runUpdate()),
    extensionApi.commands.registerCommand('aap-demo.updateExtension', () => runExtensionUpdate()),
  );

  await checkCrc(crcPath);
  if (configuration.get('openDashboardOnStartup', true)) {
    await extensionApi.commands.executeCommand('aap-demo.openDashboard');
  }
}

export function deactivate(): void {
  // Command and panel resources are owned by ExtensionContext subscriptions.
}
