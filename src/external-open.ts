import { resolveHostCommand } from './host-command';
import type { CommandRunner } from './command-runner';

export interface ExternalOpenCommand {
  command: string;
  args: string[];
}

export function getExternalOpenCommand(url: string, platform: NodeJS.Platform): ExternalOpenCommand {
  if (platform === 'darwin') {
    return { command: 'open', args: [url] };
  }
  if (platform === 'win32') {
    return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
  }
  return { command: 'xdg-open', args: [url] };
}

export async function openExternalUrl(
  url: string,
  runner: CommandRunner,
  pathValue = process.env.PATH ?? '',
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  const externalOpen = getExternalOpenCommand(url, platform);
  const hostCommand = resolveHostCommand(externalOpen.command, pathValue, environment, platform);
  await runner.run(hostCommand.command, [...hostCommand.argsPrefix, ...externalOpen.args], {
    env: { ...environment, PATH: pathValue },
  });
}
