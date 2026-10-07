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
});
