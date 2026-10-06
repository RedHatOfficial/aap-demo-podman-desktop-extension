export type CliMaintenanceMode = 'install' | 'update';

export type CliCheckoutAction =
  | 'clone'
  | 'pull'
  | 'reuse'
  | 'missing'
  | 'not-updatable'
  | 'refuse';

/** Decide whether an existing aap-demo source directory can be installed or updated safely. */
export function getCliCheckoutAction(
  mode: CliMaintenanceMode,
  locationExists: boolean,
  gitMetadataExists: boolean,
  hasAapDemoSource: boolean,
  locationIsEmpty: boolean,
): CliCheckoutAction {
  if (!locationExists) return mode === 'update' ? 'missing' : 'clone';
  if (gitMetadataExists) return 'pull';
  if (hasAapDemoSource) return mode === 'install' ? 'reuse' : 'not-updatable';
  if (locationIsEmpty && mode === 'install') return 'clone';
  return 'refuse';
}
