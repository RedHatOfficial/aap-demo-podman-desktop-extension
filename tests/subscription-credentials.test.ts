import { describe, expect, it } from 'vitest';
import {
  formatSubscriptionCredentials,
  hasUsableSubscriptionCredentials,
} from '../src/subscription-credentials';

describe('formatSubscriptionCredentials', () => {
  it('writes credentials as safely quoted YAML', () => {
    expect(formatSubscriptionCredentials('user@example.com', "p'ass:word")).toBe(
      "username: 'user@example.com'\npassword: 'p''ass:word'\n",
    );
  });

  it('recognizes credentials with both required non-empty fields', () => {
    expect(hasUsableSubscriptionCredentials(
      "username: 'user@example.com'\npassword: 'secret'\n",
    )).toBe(true);
  });

  it('rejects malformed or incomplete credential files', () => {
    expect(hasUsableSubscriptionCredentials('not yaml')).toBe(false);
    expect(hasUsableSubscriptionCredentials("username: 'user@example.com'\npassword: ''\n")).toBe(false);
  });
});
