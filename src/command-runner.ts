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

function windowsCommandQuote(value: string): string {
  if (/[\u0000-\u001f%!]/.test(value)) {
    throw new Error('Windows command arguments cannot contain control characters, % or !.');
  }
  const escaped = value.replace(/[&|<>()^]/g, '^$&').replaceAll('"', '\\"');
  return `"${escaped}"`;
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
        && ['.bat', '.cmd'].includes(path.extname(command).toLowerCase())
      ) {
        commandToSpawn = process.env.ComSpec ?? 'cmd.exe';
        argsToSpawn = [
          '/d',
          '/s',
          '/c',
          [command, ...args].map(windowsCommandQuote).join(' '),
        ];
      } else if (spawnOptions.shell) {
        return reject(
          new CommandExecutionError('Shell execution is not supported for dynamic commands', {
            exitCode: null,
            signal: null,
            stdout: '',
            stderr: '',
          }),
        );
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
