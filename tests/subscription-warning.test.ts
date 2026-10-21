import { describe, expect, it } from 'vitest';
import {
  containsMissingSubscriptionWarning,
  missingSubscriptionWarningMessage,
} from '../src/subscription-warning';

describe('containsMissingSubscriptionWarning', () => {
  it('detects the non-fatal missing-credentials subscription warning', () => {
    expect(containsMissingSubscriptionWarning([
      'No valid subscription found - attempting automatic attachment...',
      'Skipping Red Hat subscription configuration',
      '(set REDHAT_SUBSCRIPTION_USERNAME and REDHAT_SUBSCRIPTION_PASSWORD to enable)',
    ].join('\n'))).toBe(true);
  });

  it('does not warn when subscription attachment is not skipped', () => {
    expect(containsMissingSubscriptionWarning([
      'No valid subscription found - attempting automatic attachment...',
      'Attaching subscription to AAP...',
    ].join('\n'))).toBe(false);
  });

  it('explains that credentials will be requested next', () => {
    expect(missingSubscriptionWarningMessage).toContain('next prompts');
  });
});
