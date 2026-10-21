const missingSubscriptionMarkers = [
  /No valid subscription found - attempting automatic attachment/i,
  /Skipping Red Hat subscription configuration/i,
  /REDHAT_SUBSCRIPTION_USERNAME.*REDHAT_SUBSCRIPTION_PASSWORD/i,
];

const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export const missingSubscriptionWarningMessage =
  'AAP did not find a valid Red Hat subscription, so automatic subscription attachment was skipped. Deployment can continue, but subscription-dependent features may not work. Enter your Red Hat credentials in the next prompts to save them for the next deployment, or register a subscription in AAP under Settings → Subscription.';

export function containsMissingSubscriptionWarning(output: string): boolean {
  const normalized = output.replace(ANSI_ESCAPE, '').replace(/\s+/g, ' ');
  return missingSubscriptionMarkers.every(marker => marker.test(normalized));
}
