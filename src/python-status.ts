import {
  combineTrustStates,
  type AapDemoStatus,
  type ClusterState,
  type IngressCaTrustState,
} from './status-parser';

interface PythonStatusPayload {
  tool_version?: unknown;
  built?: unknown;
  infra?: unknown;
  cluster_state?: unknown;
  cluster_name?: unknown;
  kubeconfig?: unknown;
  tls?: unknown;
  routes?: unknown;
  credentials?: unknown;
  addons?: unknown;
}
function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseClusterState(value: unknown): ClusterState {
  const normalized = stringValue(value)?.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'running') return 'running';
  if (normalized === 'stopped') return 'stopped';
  if (normalized === 'not created' || normalized === 'not running') return 'not-running';
  return 'unknown';
}

function parseTrustState(value: unknown): IngressCaTrustState | undefined {
  const normalized = stringValue(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized.startsWith('not trusted')) return 'not-trusted';
  if (normalized.startsWith('trusted')) return 'trusted';
  return 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMcpRoute(url: string): boolean {
  return /(?:^|[./-])mcp(?:[./-]|$)/i.test(url);
}

function parseJson(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Python aap-demo returned invalid JSON status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function parsePythonStatusOutput(output: string): AapDemoStatus {
  const payload = parseJson(output);
  if (!isRecord(payload)) {
    throw new Error('Python aap-demo status JSON must be an object.');
  }

  const tls = isRecord(payload.tls) ? payload.tls : {};
  const routes = Array.isArray(payload.routes)
    ? payload.routes.filter((route): route is string => typeof route === 'string' && /^https?:\/\//.test(route) && !isMcpRoute(route))
    : [];
  const credentials = Array.isArray(payload.credentials)
    ? payload.credentials.flatMap(credential => {
      if (!isRecord(credential)) return [];
      const namespace = stringValue(credential.namespace);
      const username = stringValue(credential.username);
      const password = stringValue(credential.password);
      return namespace && username && password ? [{ namespace, username, password }] : [];
    })
    : [];
  const addons = Array.isArray(payload.addons)
    ? payload.addons.flatMap(addon => {
      if (!isRecord(addon)) return [];
      const name = stringValue(addon.name);
      if (!name) return [];
      const state: AapDemoStatus['addons'][number]['state'] = addon.enabled === true
        ? 'enabled'
        : addon.enabled === false
          ? 'disabled'
          : 'unknown';
      return [{ name, state }];
    })
    : [];

  const status: AapDemoStatus = {
    toolVersion: stringValue(payload.tool_version),
    built: stringValue(payload.built),
    infra: stringValue(payload.infra),
    cluster: {
      state: parseClusterState(payload.cluster_state),
      ...(stringValue(payload.cluster_name) ? { name: stringValue(payload.cluster_name) } : {}),
    },
    kubeconfig: stringValue(payload.kubeconfig),
    routes,
    credentials,
    addons,
  };
  const ingressCaTrust = combineTrustStates([
    parseTrustState(tls.system_trust),
    parseTrustState(tls.browser_trust),
  ]);
  if (ingressCaTrust) status.ingressCaTrust = ingressCaTrust;
  return status;
}
