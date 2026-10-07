import { CommandExecutionError } from './command-runner';

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

export function formatCommandError(error: unknown): string {
  if (error instanceof CommandExecutionError) {
    const output = [error.stderr, error.stdout]
      .map(value => value.trim())
      .filter(Boolean);
    const commandOutput = output.join('\n');
    const guidance = crcMemoryFailureGuidance(commandOutput)
      ?? aoOperatorTimeoutGuidance(commandOutput);
    if (guidance) {
      return [guidance, error.message, commandOutput].filter(Boolean).join('\n');
    }
    return [error.message, ...output].join('\n');
  }

  return error instanceof Error ? error.message : String(error);
}
