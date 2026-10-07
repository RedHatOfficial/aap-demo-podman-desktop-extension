export type AddonToggleState = 'enabled' | 'disabled' | 'unknown';
export type AddonToggleAction = 'enable' | 'disable';

export interface AddonTogglePresentation {
  className: string;
  action: AddonToggleAction;
  label: string;
  ariaLabel: string;
}

export function sortAddons<T extends { name: string }>(addons: T[]): T[] {
  return [...addons].sort((left, right) => left.name.localeCompare(right.name));
}

const HIDDEN_ADDONS = new Set(['fleet', 'local-cache', 'product-demo-satellite']);

export function renderableAddons<T extends { name: string }>(addons: T[]): T[] {
  return sortAddons(addons).filter(addon => !HIDDEN_ADDONS.has(addon.name));
}

function addonDisplayName(name: string): string {
  return name === 'portal' ? 'portal operator (amd64 only)' : name;
}

export function getAddonTogglePresentation(
  name: string,
  state: AddonToggleState,
): AddonTogglePresentation | undefined {
  const displayName = addonDisplayName(name);
  if (state === 'enabled') {
    return {
      className: 'addon-toggle enabled',
      action: 'disable',
      label: displayName,
      ariaLabel: `Disable ${displayName}`,
    };
  }
  if (state === 'disabled') {
    return {
      className: 'addon-toggle disabled',
      action: 'enable',
      label: displayName,
      ariaLabel: `Enable ${displayName}`,
    };
  }
  return undefined;
}
