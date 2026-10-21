import { describe, expect, it } from 'vitest';
import { shouldApplyCrcResourceSettings } from '../src/lifecycle';

describe('shouldApplyCrcResourceSettings', () => {
  it('syncs resources before explicit create and start actions', () => {
    expect(shouldApplyCrcResourceSettings('create', 'running')).toBe(true);
    expect(shouldApplyCrcResourceSettings('start', 'running')).toBe(true);
  });

  it('syncs resources before deploy starts or creates a VM', () => {
    expect(shouldApplyCrcResourceSettings('deploy', 'stopped')).toBe(true);
    expect(shouldApplyCrcResourceSettings('deploy', 'not-running')).toBe(true);
    expect(shouldApplyCrcResourceSettings('deploy', 'unknown')).toBe(true);
  });

  it('does not change CRC resources while the VM is running', () => {
    expect(shouldApplyCrcResourceSettings('deploy', 'running')).toBe(false);
    expect(shouldApplyCrcResourceSettings('status', 'stopped')).toBe(false);
  });
});
