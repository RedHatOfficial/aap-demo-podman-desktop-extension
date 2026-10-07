#!/usr/bin/env node

import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const watchers = [
  ['run', 'build:backend', '--', '--watch'],
  ['run', 'build:webview', '--', '--watch'],
];

const children = watchers.map(args => spawn(npm, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
}));

let shuttingDown = false;

function stopChildren(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const child of children) {
  child.on('exit', code => {
    if (shuttingDown) return;
    if (code && code !== 0) {
      stopChildren('SIGTERM');
      process.exitCode = code;
    }
  });
}

process.on('SIGINT', () => {
  stopChildren('SIGINT');
});

process.on('SIGTERM', () => {
  stopChildren('SIGTERM');
});
