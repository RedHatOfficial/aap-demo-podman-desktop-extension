import { describe, expect, it } from 'vitest';
import { getCliCheckoutAction } from '../src/cli-checkout';

describe('getCliCheckoutAction', () => {
  it('clones into a location that does not exist during install', () => {
    expect(getCliCheckoutAction('install', false, false, false, false)).toBe('clone');
  });

  it('clones into an existing empty directory during install', () => {
    expect(getCliCheckoutAction('install', true, false, false, true)).toBe('clone');
  });

  it('pulls an existing Git checkout', () => {
    expect(getCliCheckoutAction('install', true, true, true, false)).toBe('pull');
  });

  it('reuses a recognizable source folder during install even without Git metadata', () => {
    expect(getCliCheckoutAction('install', true, false, true, false)).toBe('reuse');
  });

  it('does not claim it can update a recognizable source folder without Git metadata', () => {
    expect(getCliCheckoutAction('update', true, false, true, false)).toBe('not-updatable');
  });

  it('refuses to reuse an unrelated existing directory', () => {
    expect(getCliCheckoutAction('install', true, false, false, false)).toBe('refuse');
  });

  it('reports a missing checkout when update is requested', () => {
    expect(getCliCheckoutAction('update', false, false, false, false)).toBe('missing');
  });
});
