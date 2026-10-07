#!/usr/bin/env node

import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

console.log('\nPodman Desktop local extension steps:');
console.log('  1. Settings -> Preferences -> Extensions -> enable Development mode');
console.log('  2. Extensions -> Local Extensions');
console.log('  3. Select Add a local folder extension...');
console.log(`  4. Select ${root}`);
console.log('  5. Start or restart AAP Demo, then reopen its dashboard');
console.log('');
