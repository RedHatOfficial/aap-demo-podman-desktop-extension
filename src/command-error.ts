import { CommandExecutionError } from './command-runner';
import { cleanTerminalOutput } from './terminal-output';

function crcMemoryFailureGuidance(output: string): string | undefined {
  const memoryMatch = output.match(/unable to allocate\s+(\d+)\s+MB of RAM/i);
  if (!memoryMatch || !/0x800705AA/i.test(output)) return undefined;

  const requestedMemory = memoryMatch[1];
  return [
    `OpenShift Local could not start because Hyper-V could not allocate ${requestedMemory} MB of RAM.`,
    'Close memory-heavy applications or stop other VMs, then retry deploy. If this machine cannot spare that much RAM, lower the Podman Desktop setting `aap-demo.memory` and restart the CRC instance; values below 16384 MiB are not supported for this demo.',
  ].join('\n');
}

function aoOperatorTimeoutGuidance(output: string): string | undefined {
  if (!/Operator deployment not Available after 5 minutes/i.test(output)) return undefined;

  return [
    'Automation Orchestrator operator did not become Available within 5 minutes.',
    'The AO subscription and PostgreSQL setup may still be settling on local CRC. Try enabling AO again; the add-on is mostly idempotent and often continues from the existing objects.',
    'If it fails again, inspect the operator resources with: kubectl get csv,subscription,pods -n automation-orchestrator',
  ].join('\n');
}

function productDemosSubscriptionGuidance(output: string): string | undefined {
  if (!/AAP does not have a registered subscription/i.test(output)) return undefined;

  const aapUrl = output.match(/AAP URL:\s*(?:\[\s*)?(https?:\/\/[^\s\])]+)/i)?.[1]
    ?? 'https://aap-aap-operator.apps.127.0.0.1.nip.io';
  return [
    'Product Demos cannot start until AAP has a registered subscription.',
    `1. Open AAP: ${aapUrl}`,
    '2. In AAP, go to Settings → Subscription and register or attach your subscription.',
    '3. Return to Podman Desktop and enable Product Demos again, or run: aap-demo enable product-demos',
  ].join('\n');
}

function crcDaemonGuidance(output: string): string | undefined {
  if (
    !/crc daemon.*cannot reach daemon api/i.test(output)
    || !/crc start failed/i.test(output)
  ) {
    return undefined;
  }

  return [
    'CRC setup is complete, but the CRC daemon is not running.',
    'Open a terminal and run:',
    '',
    'systemctl --user reset-failed crc-daemon.service && systemctl --user restart crc-http.socket crc-vsock.socket && crc status',
    '',
    'If `crc status` says “Machine does not exist,” that is expected. It means the daemon is ready and the cluster has not been created yet. Return to Podman Desktop and select Deploy again.',
  ].join('\n');
}

export function formatCommandError(error: unknown): string {
  if (error instanceof CommandExecutionError) {
    const output = [error.stderr, error.stdout]
      .map(value => cleanTerminalOutput(value).trim())
      .filter(Boolean);
    const commandOutput = output.join('\n');
    const daemonGuidance = crcDaemonGuidance(commandOutput);
    const productDemosGuidance = productDemosSubscriptionGuidance(commandOutput);
    const guidance = crcMemoryFailureGuidance(commandOutput)
      ?? daemonGuidance
      ?? aoOperatorTimeoutGuidance(commandOutput)
      ?? productDemosGuidance;
    if (guidance) {
      if (daemonGuidance) return daemonGuidance;
      if (productDemosGuidance) return productDemosGuidance;
      return [guidance, error.message, commandOutput].filter(Boolean).join('\n');
    }
    return [error.message, ...output].join('\n');
  }

  return error instanceof Error ? error.message : String(error);
}
