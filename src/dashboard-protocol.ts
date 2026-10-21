import type { AddonAction, AapDemoAction } from './aap-demo-service';

export type AoLlmProvider = 'external' | 'ollama' | 'none';

const supportedActions = new Set<AapDemoAction>([
  'create',
  'start',
  'deploy',
  'stop',
  'destroy',
  'status',
  'idle',
  'diagnose',
  'repair',
  'trust-ca',
]);

export type DashboardMessage =
  | { type: 'ready' }
  | { type: 'install-cli' }
  | { type: 'update-cli' }
  | { type: 'update-extension' }
  | { type: 'setup-extension' }
  | { type: 'install-runtime' }
  | { type: 'check-runtime' }
  | { type: 'open-crc-extension' }
  | { type: 'copy-text'; requestId: string; text: string }
  | { type: 'pah-token-response'; token?: string }
  | { type: 'pull-secret-response'; pullSecret?: string }
  | { type: 'request-pull-secret' }
  | { type: 'run'; action: AapDemoAction; idleState?: boolean }
  | { type: 'addon'; action: AddonAction; addon: string; llmProvider?: AoLlmProvider }
  | { type: 'open-url'; url: string };

export type DashboardCopyResultMessage = {
  type: 'copy-result';
  requestId: string;
  copied: boolean;
};

export function safeExternalUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function isDashboardCopyResultMessage(message: unknown): message is DashboardCopyResultMessage {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as Record<string, unknown>;
  return Object.keys(candidate).length === 3
    && candidate.type === 'copy-result'
    && typeof candidate.requestId === 'string'
    && /^copy-\d+$/.test(candidate.requestId)
    && typeof candidate.copied === 'boolean';
}

export function unwrapDashboardMessage(message: unknown): unknown {
  let current = message;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === 'string') {
      try {
        current = JSON.parse(current) as unknown;
      } catch {
        return current;
      }
      continue;
    }

    if (typeof current !== 'object' || current === null) return current;
    const wrapped = current as { data?: unknown; message?: unknown; payload?: unknown };
    if ('message' in wrapped) {
      current = wrapped.message;
      continue;
    }
    if ('data' in wrapped) {
      current = wrapped.data;
      continue;
    }
    if ('payload' in wrapped) {
      current = wrapped.payload;
      continue;
    }
    return current;
  }
  return current;
}

export function isDashboardMessage(message: unknown): message is DashboardMessage {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as Partial<DashboardMessage>;
  if (candidate.type === 'ready') return true;
  if (candidate.type === 'install-cli') return true;
  if (candidate.type === 'update-cli') return true;
  if (candidate.type === 'update-extension') return true;
  if (candidate.type === 'setup-extension') return true;
  if (candidate.type === 'install-runtime') return true;
  if (candidate.type === 'check-runtime') return true;
  if (candidate.type === 'open-crc-extension') return true;
  if (candidate.type === 'copy-text') {
    return typeof candidate.requestId === 'string'
      && candidate.requestId.length > 0
      && typeof candidate.text === 'string';
  }
  if (candidate.type === 'pah-token-response') {
    return candidate.token === undefined || typeof candidate.token === 'string';
  }
  if (candidate.type === 'pull-secret-response') {
    return candidate.pullSecret === undefined || typeof candidate.pullSecret === 'string';
  }
  if (candidate.type === 'request-pull-secret') return true;
  if (candidate.type === 'run') {
    return supportedActions.has(candidate.action as AapDemoAction);
  }
  if (candidate.type === 'open-url') {
    return safeExternalUrl(candidate.url) !== undefined;
  }
  if (candidate.type !== 'addon') return false;
  const addonMessage = candidate as {
    action?: unknown;
    addon?: unknown;
    llmProvider?: unknown;
  };
  if (
    (addonMessage.action !== 'enable' && addonMessage.action !== 'disable') ||
    typeof addonMessage.addon !== 'string' ||
    addonMessage.addon.length === 0
  ) {
    return false;
  }
  if (addonMessage.addon === 'ao' && addonMessage.action === 'enable') {
    return ['external', 'ollama', 'none'].includes(String(addonMessage.llmProvider));
  }
  return addonMessage.llmProvider === undefined;
}
