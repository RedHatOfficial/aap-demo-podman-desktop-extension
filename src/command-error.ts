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
    '2. Enter your Red Hat Developer username and password when AAP prompts you to register the subscription.',
    '3. If you do not have a subscription, get one at https://developers.redhat.com/',
    '4. Return to Podman Desktop and enable Product Demos again, or run: aap-demo enable product-demos',
  ].join('\n');
}

function crcDaemonGuidance(output: string): string | undefined {
  const normalized = output.toLowerCase();
  if (
    !normalized.includes('crc daemon')
    || !normalized.includes('cannot reach daemon api')
    || !normalized.includes('crc start failed')
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

function crcSshUnavailableGuidance(output: string): string | undefined {
  const normalized = output.toLowerCase();
  if (!normalized.includes('crc ssh not available after 3 minutes')) return undefined;

  return [
    'This is an OpenShift Local startup issue. The existing MicroShift VM was found, but its SSH service did not become available.',
    'Open the OpenShift Local extension in Podman Desktop, stop the cluster, then start it again. Return here and retry Deploy.',
    'If the restart does not resolve the issue, open a terminal and run:',
    '',
    'crc status',
    'cat /tmp/crc-start.log',
    '',
    'If CRC is still running but SSH is unavailable, run `crc stop`, wait for it to stop, then run `crc start`. Return to Podman Desktop and retry Deploy.',
  ].join('\n');
}

function deployTrustAndExistingStorageGuidance(output: string): string | undefined {
  const normalized = output.toLowerCase();
  if (
    !normalized.includes('could not add ca to system trust store')
    || !normalized.includes('persistentvolumeclaims')
    || !normalized.includes('alreadyexists')
  ) {
    return undefined;
  }

  const caPath = output.match(/Ingress CA saved to\s+(\S+)\s+but automatic trust import failed/i)?.[1]
    ?? '~/.aap-demo/crc-ingress-ca.crt';

  return [
    'Deploy found an existing AAP storage setup and could not complete the system-wide certificate import from Flatpak because sudo needs an interactive terminal.',
    'The ingress CA was saved and browser trust was updated. Do not delete the existing PostgreSQL or Hub Redis PVCs; they contain the previous deployment storage.',
    'Retry Deploy. If terminal tools still report certificate errors, open a terminal and run:',
    '',
    `sudo cp ${caPath} /etc/pki/ca-trust/source/anchors/crc-ingress-ca.crt && sudo update-ca-trust`,
    '',
    'Fully quit and reopen Chrome or Firefox if the AAP URL still shows an untrusted certificate.',
  ].join('\n');
}

function repairWithoutClusterGuidance(output: string): string | undefined {
  const normalized = output.toLowerCase();
  if (!normalized.includes('no cluster exists') || !normalized.includes('aap-demo create')) {
    return undefined;
  }

  if (normalized.includes('aap-demo diagnose') || normalized.includes('cannot proceed without cluster connectivity')) {
    return [
      'AAP Demo diagnosis cannot run because no OpenShift Local cluster exists.',
      'Select Create Cluster first and wait for it to finish. Then run Diagnose again to check cluster health.',
      'The kubeconfig path is expected to be unavailable until the cluster is created.',
    ].join('\n');
  }

  return [
    'AAP Demo repair cannot run because no OpenShift Local cluster exists.',
    'Select Create Cluster first and wait for it to finish. Then run Deploy and retry Repair if the cluster still needs recovery.',
    'The SCC commands were not run because the OpenShift API is unavailable until a cluster exists.',
  ].join('\n');
}

export function formatCommandError(error: unknown): string {
  if (error instanceof CommandExecutionError) {
    const output = [error.stderr, error.stdout]
      .map(value => cleanTerminalOutput(value).trim())
      .filter(Boolean);
    const commandOutput = output.join('\n');
    const daemonGuidance = crcDaemonGuidance(commandOutput);
    const crcSshGuidance = crcSshUnavailableGuidance(commandOutput);
    const storageGuidance = deployTrustAndExistingStorageGuidance(commandOutput);
    const repairGuidance = repairWithoutClusterGuidance(commandOutput);
    const productDemosGuidance = productDemosSubscriptionGuidance(commandOutput);
    const guidance = crcMemoryFailureGuidance(commandOutput)
      ?? daemonGuidance
      ?? crcSshGuidance
      ?? storageGuidance
      ?? repairGuidance
      ?? aoOperatorTimeoutGuidance(commandOutput)
      ?? productDemosGuidance;
    if (guidance) {
      if (daemonGuidance) return daemonGuidance;
      if (crcSshGuidance) return crcSshGuidance;
      if (storageGuidance) return storageGuidance;
      if (repairGuidance) return repairGuidance;
      if (productDemosGuidance) return productDemosGuidance;
      return [guidance, error.message, commandOutput].filter(Boolean).join('\n');
    }
    return [error.message, ...output].join('\n');
  }

  return error instanceof Error ? error.message : String(error);
}
