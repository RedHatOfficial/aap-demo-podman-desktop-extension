import { describe, expect, it } from 'vitest';
import { CommandExecutionError } from '../src/command-runner';
import { formatCommandError } from '../src/command-error';

describe('formatCommandError', () => {
  it('includes captured stderr and stdout from a failed command', () => {
    const error = new CommandExecutionError('Command exited unsuccessfully: aap-demo', {
      exitCode: 1,
      signal: null,
      stderr: 'Start with: aap-demo create',
      stdout: 'Cluster: not running',
    });

    expect(formatCommandError(error)).toBe(
      'Command exited unsuccessfully: aap-demo\nStart with: aap-demo create\nCluster: not running',
    );
  });

  it('formats ordinary errors without adding empty output lines', () => {
    expect(formatCommandError(new Error('not found'))).toBe('not found');
  });

  it('adds actionable guidance for CRC Hyper-V memory allocation failures', () => {
    const error = new CommandExecutionError('Command exited unsuccessfully: aap-demo', {
      exitCode: 1,
      signal: null,
      stderr: '',
      stdout: "'crc' is unable to allocate 16384 MB of RAM: Insufficient system resources exist to complete the requested service. (0x800705AA).",
    });

    expect(formatCommandError(error)).toContain(
      'OpenShift Local could not start because Hyper-V could not allocate 16384 MB of RAM.',
    );
    expect(formatCommandError(error)).toContain('aap-demo.memory');
    expect(formatCommandError(error)).toContain('0x800705AA');
  });

  it('adds actionable guidance for AO operator readiness timeouts', () => {
    const error = new CommandExecutionError('Command exited unsuccessfully: aap-demo', {
      exitCode: 1,
      signal: null,
      stderr: '',
      stdout: [
        'Waiting for operator to become available...',
        'ERROR: Operator deployment not Available after 5 minutes.',
        'NAME READY STATUS RESTARTS AGE',
        'orchestrator-postgres-1 1/1 Running 0 61s',
      ].join('\n'),
    });

    const message = formatCommandError(error);
    expect(message).toContain('Automation Orchestrator operator did not become Available within 5 minutes.');
    expect(message).toContain('Try enabling AO again');
    expect(message).toContain('kubectl get csv,subscription,pods -n automation-orchestrator');
    expect(message).toContain('Operator deployment not Available after 5 minutes');
  });

  it('explains how to restart the CRC daemon after setup is complete', () => {
    const error = new CommandExecutionError('Command exited unsuccessfully: flatpak-spawn', {
      exitCode: 1,
      signal: null,
      stderr: '',
      stdout: [
        "To confirm your system is ready, and you have the needed system bundle, please run 'crc setup' before 'crc start'.",
        'Is \'crc daemon\' running? Cannot reach daemon API',
        'ERROR: crc start failed',
      ].join('\n'),
    });

    const message = formatCommandError(error);
    expect(message).toContain('CRC setup is complete, but the CRC daemon is not running.');
    expect(message).toContain(
      'Open a terminal and run:\n\nsystemctl --user reset-failed crc-daemon.service && systemctl --user restart crc-http.socket crc-vsock.socket && crc status\n',
    );
    expect(message).toContain('If `crc status` says “Machine does not exist,” that is expected.');
    expect(message).not.toContain('`systemctl');
    expect(message).toContain('Return to Podman Desktop and select Deploy again.');
    expect(message).not.toContain('Command exited unsuccessfully: flatpak-spawn');
    expect(message).not.toContain('Is \'crc daemon\' running?');
  });

  it('explains how to recover when CRC SSH is unavailable', () => {
    const error = new CommandExecutionError('Command exited unsuccessfully: flatpak-spawn', {
      exitCode: 1,
      signal: null,
      stderr: '',
      stdout: [
        'A CRC VM for MicroShift 4.22.13 is already running',
        'Started the MicroShift cluster.',
        'CRC SSH not available after 3 minutes',
        'Check CRC status: crc status',
        'Check CRC logs: cat /tmp/crc-start.log',
      ].join('\n'),
    });

    const message = formatCommandError(error);
    expect(message).toContain('This is an OpenShift Local startup issue.');
    expect(message).toContain('Open the OpenShift Local extension in Podman Desktop, stop the cluster, then start it again.');
    expect(message).toContain('existing MicroShift VM was found');
    expect(message).toContain('crc status\ncat /tmp/crc-start.log');
    expect(message).toContain('run `crc stop`');
    expect(message).not.toContain('Command exited unsuccessfully: flatpak-spawn');
    expect(message).not.toContain('A CRC VM for MicroShift 4.22.13 is already running');
  });

  it('explains that repair requires a cluster before applying SCC changes', () => {
    const error = new CommandExecutionError('Command exited unsuccessfully: flatpak-spawn', {
      exitCode: 1,
      signal: null,
      stderr: '',
      stdout: [
        'ERROR: Failed to grant anyuid SCC to namespace aap-operator',
        'WARNING: No cluster exists',
        "Run 'aap-demo create' first",
        'Running repair...',
        'oc output: Error from server (InternalError): an error on the server has prevented the request from succeeding',
        'Fix manually: oc adm policy add-scc-to-group anyuid system:serviceaccounts',
      ].join('\n'),
    });

    const message = formatCommandError(error);
    expect(message).toContain('AAP Demo repair cannot run because no OpenShift Local cluster exists.');
    expect(message).toContain('Select Create Cluster first');
    expect(message).toContain('The SCC commands were not run');
    expect(message).not.toContain('oc adm policy add-scc-to-group');
    expect(message).not.toContain('Command exited unsuccessfully: flatpak-spawn');
  });

  it('explains that diagnosis requires a cluster', () => {
    const error = new CommandExecutionError('Command exited unsuccessfully: flatpak-spawn', {
      exitCode: 1,
      signal: null,
      stderr: '',
      stdout: [
        'WARNING: No cluster exists',
        "Run 'aap-demo create' first",
        'aap-demo diagnose - Checking environment health...',
        'Cannot proceed without cluster connectivity. Check KUBECONFIG: /home/test/.aap-demo/kubeconfig.microshift',
      ].join('\n'),
    });

    const message = formatCommandError(error);
    expect(message).toContain('AAP Demo diagnosis cannot run because no OpenShift Local cluster exists.');
    expect(message).toContain('Select Create Cluster first');
    expect(message).toContain('kubeconfig path is expected to be unavailable');
    expect(message).not.toContain('kubeconfig.microshift');
    expect(message).not.toContain('Command exited unsuccessfully: flatpak-spawn');
  });

  it('explains how to register an AAP subscription before Product Demos', () => {
    const error = new CommandExecutionError('Command exited unsuccessfully: flatpak-spawn', {
      exitCode: 1,
      signal: null,
      stderr: '',
      stdout: [
        'AAP URL: https://aap-aap-operator.apps.127.0.0.1.nip.io',
        'ERROR: AAP does not have a registered subscription.',
        'Log into AAP and register a subscription (Settings → Subscription), then re-run: aap-demo enable product-demos',
      ].join('\n'),
    });

    const message = formatCommandError(error);
    expect(message).toContain('Product Demos cannot start until AAP has a registered subscription.');
    expect(message).toContain('1. Open AAP: https://aap-aap-operator.apps.127.0.0.1.nip.io');
    expect(message).toContain('2. Enter your Red Hat Developer username and password when AAP prompts you to register the subscription.');
    expect(message).toContain('3. If you do not have a subscription, get one at https://developers.redhat.com/');
    expect(message).toContain('4. Return to Podman Desktop and enable Product Demos again');
    expect(message).toContain('aap-demo enable product-demos');
    expect(message).not.toContain('Command exited unsuccessfully: flatpak-spawn');
    expect(message).not.toContain('Retrieving AAP connection details');
  });
});
