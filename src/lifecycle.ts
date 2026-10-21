import type { AapDemoAction } from './aap-demo-service';
import type { ClusterState } from './status-parser';

export function shouldApplyCrcResourceSettings(
  action: AapDemoAction,
  clusterState: ClusterState = 'unknown',
): boolean {
  if (action === 'create' || action === 'start') return true;
  return action === 'deploy' && clusterState !== 'running';
}
