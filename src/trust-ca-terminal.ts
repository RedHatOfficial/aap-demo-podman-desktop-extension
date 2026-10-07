import { spawn } from 'node:child_process';
import type { RuntimeTerminalLauncher, TerminalLaunchSpec } from './runtime-installer';

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function appleScriptQuote(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function createTrustCaTerminalLaunchSpec(
  cliPath: string,
  pathValue: string,
  platform: NodeJS.Platform = process.platform,
): TerminalLaunchSpec | undefined {
  if (platform !== 'darwin') return undefined;

  const command = [
    `export PATH=${shellQuote(pathValue)}`,
    'export PYTHONIOENCODING=utf-8',
    'export PYTHONUTF8=1',
    `${shellQuote(cliPath)} trust-ca`,
    "printf '\\nAAP Demo Fix SSL finished. Close this terminal when ready.\\n'",
    'read -r',
  ].join('; ');
  const script = `tell application "Terminal" to do script "${appleScriptQuote(command)}"`;
  return { command: 'osascript', args: ['-e', script] };
}

export function launchTrustCaInTerminal(
  cliPath: string,
  pathValue: string,
  launcher: RuntimeTerminalLauncher = systemTerminalLauncher,
): Promise<void> {
  const spec = createTrustCaTerminalLaunchSpec(cliPath, pathValue);
  if (!spec) {
    return Promise.reject(
      new Error('Interactive Fix SSL terminal launch is only available on macOS.'),
    );
  }
  return launcher.launch(spec);
}

const systemTerminalLauncher: RuntimeTerminalLauncher = {
  launch(spec): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(spec.command, spec.args, { detached: true, stdio: 'ignore' });
      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
  },
};
