import { describe, expect, it } from 'vitest';
import { formatSubscriptionCredentials } from '../src/subscription-credentials';

describe('formatSubscriptionCredentials', () => {
  it('writes credentials as safely quoted YAML', () => {
    expect(formatSubscriptionCredentials('user@example.com', "p'ass:word")).toBe(
      "username: 'user@example.com'\npassword: 'p''ass:word'\n",
    );
  });
});
