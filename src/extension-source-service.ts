import type { CommandResult, CommandRunner, CommandRunnerOptions } from './command-runner';
import { getExtensionCheckoutAction, parseNodeMajorVersion } from './extension-source';

export const AAP_DEMO_EXTENSION_REPOSITORY_URL =
  'https://github.com/RedHatOfficial/aap-demo-podman-desktop-extension.git';

export type ExtensionSourceStreams = Pick<CommandRunnerOptions, 'onStdout' | 'onStderr'>;
export type CommandExecutor = Pick<CommandRunner, 'run'>;

export interface ExtensionSourceServiceOptions {
  checkoutPath: string;
  pathValue: string;
  pathExists: (candidate: string) => boolean;
  gitMetadataExists: (candidate: string) => boolean;
  platform?: NodeJS.Platform;
}

export class MissingRuntimeError extends Error {
  constructor(
    public readonly runtime: 'node' | 'npm',
    public readonly reason: 'missing' | 'outdated' | 'unusable',
    public readonly detectedVersion?: number,
  ) {
    const message = runtime === 'node' && reason === 'outdated'
      ? `Building the local extension requires Node.js 24 or newer; found Node.js ${detectedVersion}.`
      : runtime === 'node'
        ? 'Building the local extension requires Node.js 24 or newer.'
        : 'Building the local extension requires npm, which is not available on PATH.';
    super(message);
    this.name = 'MissingRuntimeError';
  }
}

export class ExtensionSourceService {
  constructor(
    private readonly executor: CommandExecutor,
    private readonly options: ExtensionSourceServiceOptions,
  ) {}

  async prepare(streams: ExtensionSourceStreams = {}): Promise<CommandResult> {
    const { checkoutPath, pathExists, gitMetadataExists } = this.options;
    const windows = (this.options.platform ?? process.platform) === 'win32';
    const npmCommand = windows ? 'npm.cmd' : 'npm';
    const action = getExtensionCheckoutAction(
      pathExists(checkoutPath),
      gitMetadataExists(checkoutPath),
    );

    if (action === 'refuse') {
      throw new Error(
        `Extension install location is not a Git checkout: ${checkoutPath}. Choose another directory in aap-demo.extensionInstallLocation.`,
      );
    }

    if (action === 'clone') {
      await this.run('git', ['clone', AAP_DEMO_EXTENSION_REPOSITORY_URL, checkoutPath], streams);
    } else {
      const origin = await this.run(
        'git', ['-C', checkoutPath, 'remote', 'get-url', 'origin'], streams,
      );
      if (origin.stdout.trim() !== AAP_DEMO_EXTENSION_REPOSITORY_URL) {
        throw new Error(
          `Extension checkout origin is not the official repository: ${origin.stdout.trim() || '(empty)'}.`,
        );
      }
      let upstream: string;
      try {
        upstream = (await this.run(
          'git', [
            '-C', checkoutPath, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}',
          ], streams,
        )).stdout.trim();
      } catch {
        throw new Error(
          'Extension checkout has no official origin upstream. Configure its branch to track origin before updating.',
        );
      }
      const remoteSeparator = upstream.indexOf('/');
      const remote = remoteSeparator < 0 ? '' : upstream.slice(0, remoteSeparator);
      const branch = remoteSeparator < 0 ? '' : upstream.slice(remoteSeparator + 1);
      if (remote !== 'origin' || !branch) {
        throw new Error(
          `Extension checkout upstream is not the official origin remote: ${upstream || '(empty)'}.`,
        );
      }
      await this.run(
        'git', ['-C', checkoutPath, 'pull', '--ff-only', 'origin', `refs/heads/${branch}`], streams,
      );
    }

    let nodeOutput: string;
    try {
      nodeOutput = (await this.run('node', ['--version'], streams)).stdout;
    } catch {
      throw new MissingRuntimeError('node', 'missing');
    }
    const nodeMajor = parseNodeMajorVersion(nodeOutput);
    if (nodeMajor === undefined) throw new MissingRuntimeError('node', 'unusable');
    if (nodeMajor < 24) throw new MissingRuntimeError('node', 'outdated', nodeMajor);

    try {
      await this.run(npmCommand, ['--version'], streams);
    } catch {
      throw new MissingRuntimeError('npm', 'missing');
    }

    await this.run(npmCommand, ['ci'], streams, checkoutPath);
    return this.run(npmCommand, ['run', 'build'], streams, checkoutPath);
  }

  private run(
    command: string,
    args: readonly string[],
    streams: ExtensionSourceStreams = {},
    cwd?: string,
  ): Promise<CommandResult> {
    const options: CommandRunnerOptions = {
      env: { ...process.env, PATH: this.options.pathValue },
      ...streams,
    };
    if (cwd) options.cwd = cwd;
    return this.executor.run(command, args, options).catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      if (command === 'git' && /\bENOENT\b/.test(message)) {
        throw new Error('Git is required to set up or update the local extension. Install Git, restart Podman Desktop, and try again.');
      }
      throw error;
    });
  }
}
