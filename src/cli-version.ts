import type { CommandExecutor } from './aap-demo-service';
import { resolveHostCommand } from './host-command';

const semanticVersionPattern = /\bv?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/;

export function parseCliVersion(output: string): string {
  return output.match(semanticVersionPattern)?.[1] ?? 'unknown';
}

export async function detectCliVersion(
  executor: CommandExecutor,
  cliPath: string,
  pathValue = process.env.PATH ?? '',
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  try {
    const command = environment.FLATPAK_ID
      ? resolveHostCommand(cliPath, pathValue, environment)
      : { command: cliPath, argsPrefix: [] };
    const result = await executor.run(command.command, [...command.argsPrefix, '--version']);
    return parseCliVersion(`${result.stdout}\n${result.stderr}`);
  } catch {
    return 'unknown';
  }
}
