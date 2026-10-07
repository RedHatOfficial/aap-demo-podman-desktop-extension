import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
import * as path from 'node:path';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunnerOptions extends SpawnOptionsWithoutStdio {
  input?: string;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export class CommandExecutionError extends Error {
  public readonly exitCode: number | null;
  public readonly stdout: string;
  public readonly stderr: string;
  public readonly signal: NodeJS.Signals | null;

  constructor(
    message: string,
    result: Omit<CommandResult, 'exitCode'> & {
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    },
  ) {
    super(message);
    this.name = 'CommandExecutionError';
    this.exitCode = result.exitCode;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.signal = result.signal;
  }
}

function windowsShellQuote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

export class CommandRunner {
  run(
    command: string,
    args: readonly string[] = [],
    options: CommandRunnerOptions = {},
  ): Promise<CommandResult> {
    if (!command.trim()) {
      return Promise.reject(
        new CommandExecutionError('Cannot execute an empty command', {
          exitCode: null,
          signal: null,
          stdout: '',
          stderr: '',
        }),
      );
    }

    return new Promise((resolve, reject) => {
      const { input, onStdout, onStderr, ...spawnOptions } = options;
      let commandToSpawn = command;
      let argsToSpawn = args;
      if (
        process.platform === 'win32'
        && spawnOptions.shell === undefined
        && ['.bat', '.cmd'].includes(path.extname(command).toLowerCase())
      ) {
        spawnOptions.shell = true;
        commandToSpawn = [command, ...args].map(windowsShellQuote).join(' ');
        argsToSpawn = [];
      }
      const child = spawn(commandToSpawn, argsToSpawn, spawnOptions);
      if (input !== undefined) child.stdin?.end(input);
      let stdout = '';
      let stderr = '';

      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', chunk => {
        const text = String(chunk);
        stdout += text;
        onStdout?.(text);
      });
      child.stderr?.on('data', chunk => {
        const text = String(chunk);
        stderr += text;
        onStderr?.(text);
      });
      child.on('error', error => {
        reject(
          new CommandExecutionError(error.message, {
            exitCode: null,
            signal: null,
            stdout,
            stderr,
          }),
        );
      });
      child.on('close', (exitCode, signal) => {
        if (exitCode === 0) {
          resolve({ exitCode, stdout, stderr });
          return;
        }

        reject(
          new CommandExecutionError(`Command exited unsuccessfully: ${command}`, {
            exitCode,
            signal,
            stdout,
            stderr,
          }),
        );
      });
    });
  }
}
