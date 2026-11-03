import { describe, expect, it } from 'vitest';
import { parsePythonStatusOutput } from '../src/python-status';

const runningStatus = JSON.stringify({
  tool_version: '2.0.0.dev2',
  built: 'unknown',
  infra: 'OpenShift Local (CRC)',
  cluster_state: 'running',
  cluster_name: 'crc-microshift',
  kubeconfig: '/Users/example/.local/state/aap-demo/kubeconfig.microshift',
  tls: { system_trust: 'trusted', browser_trust: 'trusted' },
  routes: ['https://aap.apps.example.test', 'https://mcp-server.apps.example.test/mcp'],
  credentials: [{ namespace: 'aap', username: 'admin', password: 'secret' }],
  addons: [{ name: 'portal', enabled: false }],
});
describe('parsePythonStatusOutput', () => {
  it('maps Python JSON status to the dashboard status model', () => {
    expect(parsePythonStatusOutput(runningStatus)).toMatchObject({
      toolVersion: '2.0.0.dev2',
      cluster: { state: 'running', name: 'crc-microshift' },
      kubeconfig: '/Users/example/.local/state/aap-demo/kubeconfig.microshift',
      routes: ['https://aap.apps.example.test'],
      credentials: [{ namespace: 'aap', username: 'admin', password: 'secret' }],
      addons: [{ name: 'portal', state: 'disabled' }],
      ingressCaTrust: 'trusted',
    });
  });

  it('maps Python not_created and stopped states to existing dashboard states', () => {
    expect(parsePythonStatusOutput('{"cluster_state":"not_created"}').cluster.state).toBe('not-running');
    expect(parsePythonStatusOutput('{"cluster_state":"stopped"}').cluster.state).toBe('stopped');
  });
});

