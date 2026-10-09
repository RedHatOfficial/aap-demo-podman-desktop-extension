const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export type ClusterState = 'running' | 'stopped' | 'not-running' | 'unknown';
export type IngressCaTrustState = 'trusted' | 'not-trusted' | 'unknown';

export interface AapDemoStatus {
  toolVersion?: string;
  built?: string;
  infra?: string;
  cluster: {
    state: ClusterState;
    name?: string;
  };
  kubeconfig?: string;
  ingressCaTrust?: IngressCaTrustState;
  routes: string[];
  credentials: Array<{
    namespace: string;
    username: string;
    password: string;
  }>;
  addons: Array<{
    name: string;
    state: 'enabled' | 'disabled' | 'unknown';
    url?: string;
  }>;
}

function parseCluster(value: string): AapDemoStatus['cluster'] {
  const name = value.match(/\(([^)]+)\)\s*$/)?.[1];
  const normalized = value.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  let state: ClusterState = 'unknown';
  if (normalized === 'running') state = 'running';
  if (normalized === 'stopped') state = 'stopped';
  if (normalized === 'not running') state = 'not-running';
  return name ? { state, name } : { state };
}

function isMcpRoute(url: string): boolean {
  return /(?:^|[./-])mcp(?:[./-]|$)/i.test(url);
}

function combineTrustStates(states: Array<IngressCaTrustState | undefined>): IngressCaTrustState | undefined {
  if (states.includes('not-trusted')) return 'not-trusted';
  if (states.includes('unknown')) return 'unknown';
  return states.find(Boolean);
}

export function parseStatusOutput(output: string): AapDemoStatus {
  const status: AapDemoStatus = {
    cluster: { state: 'unknown' },
    routes: [],
    credentials: [],
    addons: [],
  };
  let section: 'routes' | 'credentials' | 'addons' | 'tls' | undefined;
  let systemTrust: IngressCaTrustState | undefined;
  let browserTrust: IngressCaTrustState | undefined;

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.replace(ANSI_ESCAPE, '');
    const trimmed = line.trim();
    if (!trimmed || /^[-=]+$/.test(trimmed)) continue;

    if (trimmed === 'AAP Deployments:') {
      section = 'routes';
      continue;
    }
    if (trimmed === 'Credentials:') {
      section = 'credentials';
      continue;
    }
    if (trimmed === 'Addons:') {
      section = 'addons';
      continue;
    }
    if (trimmed === 'TLS:') {
      section = 'tls';
      continue;
    }
    if (/^[A-Za-z][A-Za-z0-9 -]*:$/.test(trimmed)) {
      section = undefined;
    }

    if (section === 'tls') {
      const trust = trimmed.match(/^(System|Browser) trust:\s*(.+)$/i);
      if (trust) {
        const value = trust[2].trim().toLowerCase();
        const state: IngressCaTrustState = value.startsWith('not trusted')
          ? 'not-trusted'
          : value.startsWith('trusted')
            ? 'trusted'
            : 'unknown';
        if (trust[1].toLowerCase() === 'browser') browserTrust = state;
        else systemTrust = state;
      }
      continue;
    }

    const tool = trimmed.match(/^Tool:\s*(.+)$/);
    if (tool) status.toolVersion = tool[1];
    const built = trimmed.match(/^Built:\s*(.+)$/);
    if (built) status.built = built[1];
    const infra = trimmed.match(/^Infra:\s*(.+)$/);
    if (infra) status.infra = infra[1];
    const cluster = trimmed.match(/^Cluster:\s*(.+)$/);
    if (cluster) status.cluster = parseCluster(cluster[1]);
    const kubeconfig = trimmed.match(/^Kubeconfig:\s*(.+)$/);
    if (kubeconfig) status.kubeconfig = kubeconfig[1];

    if (section === 'routes' && /^https?:\/\//.test(trimmed) && !isMcpRoute(trimmed)) {
      status.routes.push(trimmed);
      continue;
    }

    if (section === 'credentials') {
      const credential = trimmed.match(/^([^:]+):\s+([^/]+?)\s+\/\s*(.*)$/);
      if (credential) {
        status.credentials.push({
          namespace: credential[1].trim(),
          username: credential[2].trim(),
          password: credential[3].trim(),
        });
      }
      continue;
    }

    if (section === 'addons') {
      const addon = trimmed.match(/^(\S+)\s+(.+)$/);
      if (!addon) continue;
      const [name, label] = addon.slice(1);
      const url = label.match(/https?:\/\/\S+/)?.[0];
      const state = label.startsWith('enabled') || url
        ? 'enabled'
        : label.startsWith('disabled')
          ? 'disabled'
          : 'unknown';
      status.addons.push({ name, state, ...(url ? { url } : {}) });
    }
  }

  const ingressCaTrust = combineTrustStates([systemTrust, browserTrust]);
  if (ingressCaTrust) status.ingressCaTrust = ingressCaTrust;
  return status;
}
