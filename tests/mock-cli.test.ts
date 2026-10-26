import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CommandRunner } from '../src/command-runner';
import { parseStatusOutput } from '../src/status-parser';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('mock aap-demo CLI', () => {
  it('changes simulated cluster state without invoking real infrastructure', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'aap-demo-mock-cli-'));
    temporaryRoots.push(directory);
    const cliPath = path.resolve(
      'scripts',
      process.platform === 'win32' ? 'mock-aap-demo.cmd' : 'mock-aap-demo.sh',
    );
    const stateFile = path.join(directory, 'state.json');
    const runner = new CommandRunner();
    const options = {
      env: {
        [process.platform === 'win32' ? 'Path' : 'PATH']: process.env.PATH,
        AAP_DEMO_MOCK_STATE_FILE: stateFile,
      },
    };

    await runner.run(cliPath, ['reset'], options);
    const initial = await runner.run(cliPath, ['status'], options);
    expect(parseStatusOutput(initial.stdout).cluster.state).toBe('not-running');

    await runner.run(cliPath, ['create'], options);
    const created = await runner.run(cliPath, ['status'], options);
    expect(parseStatusOutput(created.stdout).cluster.state).toBe('running');

    await runner.run(cliPath, ['stop'], options);
    const stopped = await runner.run(cliPath, ['status'], options);
    expect(parseStatusOutput(stopped.stdout).cluster.state).toBe('stopped');

    await runner.run(cliPath, ['destroy'], options);
    const destroyed = await runner.run(cliPath, ['status'], options);
    expect(parseStatusOutput(destroyed.stdout).cluster.state).toBe('not-running');
  }, 15_000);
});
