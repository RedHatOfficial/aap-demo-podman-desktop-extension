import { existsSync } from 'node:fs';
import * as path from 'node:path';

export function isLocalExtensionCheckout(
  extensionPath: string,
  exists: (candidate: string) => boolean = existsSync,
): boolean {
  return exists(path.join(extensionPath, '.git'));
}
