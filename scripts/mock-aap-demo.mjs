#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const statePath = process.env.AAP_DEMO_MOCK_STATE_FILE
  || path.join(os.tmpdir(), 'aap-demo-mock-state.json');

function defaultState() {
  return {
    cluster: 'not-running',
    idle: false,
    addons: {},
  };
}

function readState() {
  if (!existsSync(statePath)) return defaultState();
  try {
    return { ...defaultState(), ...JSON.parse(readFileSync(statePath, 'utf8')) };
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function print(message) {
  writeSync(1, `${message}\n`);
}

function printError(message) {
  writeSync(2, `${message}\n`);
}

function printStatus(state) {
  const clusterLabel = state.cluster === 'running'
    ? 'Running (mock)'
    : state.cluster === 'stopped'
      ? 'Stopped (mock)'
      : 'Not running';
  print([
    'Tool: aap-demo 0.0.0-mock',
    'Built: local simulator',
    'Infra: mock',
    `Cluster: ${clusterLabel}`,
    'AAP Deployments:',
    ...(state.cluster === 'running' ? ['https://controller.example.test'] : []),
    'Credentials:',
    ...(state.cluster === 'running' ? ['default: admin / mock-password'] : []),
    'Addons:',
    ...['ansible-lightspeed', 'ao', 'mcp-server', 'product-demos', 'setup-pah'].map(
      addon => `${addon} ${state.addons[addon] ? 'enabled' : 'disabled'}`,
    ),
    'TLS:',
    'System trust: trusted',
    'Browser trust: trusted',
  ].join('\n'));
}

const [action = 'status', ...args] = process.argv.slice(2);
const state = readState();

if (action === '--version') {
  print('aap-demo 0.0.0-mock');
} else if (action === 'status') {
  printStatus(state);
} else if (action === 'reset') {
  writeState(defaultState());
  print('[mock] Simulator reset.');
} else if (action === 'create' || action === 'start' || action === 'deploy') {
  state.cluster = 'running';
  writeState(state);
  print(`[mock] Simulated ${action} completed.`);
} else if (action === 'stop') {
  state.cluster = 'stopped';
  writeState(state);
  print('[mock] Simulated stop completed.');
} else if (action === 'destroy') {
  writeState(defaultState());
  print('[mock] Simulated destroy completed.');
} else if (action === 'idle') {
  state.idle = args[0] !== 'false';
  writeState(state);
  print(`[mock] Simulated idle state: ${state.idle}.`);
} else if (action === 'diagnose' || action === 'repair') {
  print(`[mock] Simulated ${action} completed.`);
} else if (action === 'enable' || action === 'disable') {
  const addon = args[0];
  if (!addon) {
    printError('[mock] An add-on name is required.');
    process.exitCode = 2;
  } else {
    state.addons[addon] = action === 'enable';
    writeState(state);
    print(`[mock] Simulated ${action} ${addon}.`);
  }
} else {
  printError(`[mock] Unsupported command: ${action}`);
  process.exitCode = 2;
}
