import type { AapDemoStatus } from '../status-parser';

export function shouldShowFixSsl(status: AapDemoStatus): boolean {
  return status.cluster.state === 'running'
    && status.ingressCaTrust !== undefined
    && status.ingressCaTrust !== 'trusted';
}
