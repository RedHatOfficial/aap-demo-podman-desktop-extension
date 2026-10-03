import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAddonTogglePresentation, sortAddons } from '../src/webview/addon-ui';

const dashboardHtml = readFileSync(resolve(__dirname, '../src/webview/index.html'), 'utf8');
const packageJson = readFileSync(resolve(__dirname, '../package.json'), 'utf8');
const containerfile = readFileSync(resolve(__dirname, '../Containerfile'), 'utf8');

describe('getAddonTogglePresentation', () => {
  it('uses a green enabled toggle that disables the add-on when clicked', () => {
    expect(getAddonTogglePresentation('fleet', 'enabled')).toEqual({
      className: 'addon-toggle enabled',
      action: 'disable',
      label: 'fleet',
      ariaLabel: 'Disable fleet',
    });
  });

  it('uses a red disabled toggle that enables the add-on when clicked', () => {
    expect(getAddonTogglePresentation('fleet', 'disabled')).toEqual({
      className: 'addon-toggle disabled',
      action: 'enable',
      label: 'fleet',
      ariaLabel: 'Enable fleet',
    });
  });

  it('does not offer a toggle for an unknown state', () => {
    expect(getAddonTogglePresentation('fleet', 'unknown')).toBeUndefined();
  });

  it('sorts add-ons alphabetically without mutating the status array', () => {
    const addons = [{ name: 'portal' }, { name: 'ao' }, { name: 'fleet' }];

    expect(sortAddons(addons).map(addon => addon.name)).toEqual(['ao', 'fleet', 'portal']);
    expect(addons.map(addon => addon.name)).toEqual(['portal', 'ao', 'fleet']);
  });

  it('labels the section and explains the toggle colors', () => {
    expect(dashboardHtml).toContain('<h2>Addons</h2>');
    expect(dashboardHtml).toContain('green means enabled and grey means disabled');
    expect(dashboardHtml).not.toContain('Add-on actions');
  });

  it('keeps prerequisites inside the Status card', () => {
    const statusStart = dashboardHtml.indexOf('<div class="status" id="status">');
    const statusEnd = dashboardHtml.indexOf('<div class="actions">', statusStart);

    expect(dashboardHtml.slice(statusStart, statusEnd)).toContain('<h2>Status</h2>');
    expect(dashboardHtml.slice(statusStart, statusEnd)).toContain('id="prerequisite-list"');
    expect(dashboardHtml).not.toContain('<h3>Prerequisites</h3>');
    expect(dashboardHtml).not.toContain('<section class="card" id="prerequisites">');
  });

  it('offers the install script when the aap-demo CLI is unavailable', () => {
    expect(dashboardHtml).toContain('id="install-cli"');
    expect(dashboardHtml).toContain('Install aap-demo');
  });

  it('places start and stop controls beside Deploy AAP', () => {
    const actionsStart = dashboardHtml.indexOf('<div class="actions">');
    const actionsEnd = dashboardHtml.indexOf('</div>', actionsStart);
    const actionRow = dashboardHtml.slice(actionsStart, actionsEnd);

    expect(actionRow).toContain('data-action="start"');
    expect(actionRow).toContain('>Start</button>');
    expect(actionRow).toContain('data-action="stop"');
    expect(actionRow).toContain('>Stop</button>');
  });

  it('shows the Ansible Automation Platform logo in the dashboard header', () => {
    expect(dashboardHtml).toContain('<img src="./assets/ansible-logo.png" alt="Ansible Automation Platform logo"');
  });

  it('keeps the primary lifecycle actions ordered beside Deploy AAP', () => {
    const actionsStart = dashboardHtml.indexOf('<div class="actions">');
    const actionsEnd = dashboardHtml.indexOf('</div>', actionsStart);
    const actionRow = dashboardHtml.slice(actionsStart, actionsEnd);

    expect(actionRow).not.toContain('data-action="create"');
    expect(actionRow).toContain('<button class="primary" data-action="start">Start</button>');
    expect(actionRow).toContain('<button class="primary" data-action="diagnose">Diagnose</button>');
    expect(actionRow).toContain('<button class="primary" id="idle-toggle">Set idle</button>');
    expect(actionRow.indexOf('data-action="deploy"')).toBeLessThan(actionRow.indexOf('data-action="start"'));
  });

  it('declares and packages the extension icon for Podman Desktop', () => {
    expect(packageJson).toContain('"icon": "icon.png"');
    expect(packageJson).toContain('"activationEvents": ["onStartupFinished"]');
    expect(containerfile).toContain('COPY icon.png /extension/icon.png');
  });

  it('adds space below the Addons section', () => {
    expect(dashboardHtml).toContain('.addons-card { margin-bottom: 14px; }');
    expect(dashboardHtml).toContain('<section class="card addons-card">');
  });
});
