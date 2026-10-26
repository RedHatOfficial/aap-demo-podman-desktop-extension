import { describe, expect, it } from 'vitest';
import { attachRedHatSubscription } from '../src/subscription-attach';

const controller = {
  url: 'https://aap.example.test',
  username: 'admin',
  password: 'controller-password',
};

const subscription = {
  username: 'user@example.com',
  password: 'red-hat-password',
};

describe('attachRedHatSubscription', () => {
  it('attaches the first returned subscription id through the controller API', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    const result = await attachRedHatSubscription({
      controller,
      subscription,
      requestJson: async (_controller, method, path, body) => {
        calls.push({ method, path, body });
        if (path === '/api/controller/v2/config/') return { license_info: {} };
        if (path === '/api/controller/v2/config/subscriptions/') {
          return [
            {
              subscription_id: 'sub-1',
              subscription_name: 'Red Hat Ansible Automation Platform',
            },
          ];
        }
        return {
          subscription_id: 'sub-1',
          subscription_name: 'Red Hat Ansible Automation Platform',
          valid_key: true,
        };
      },
    });

    expect(result).toEqual({
      status: 'attached',
      subscriptionName: 'Red Hat Ansible Automation Platform',
    });
    expect(calls).toEqual([
      { method: 'GET', path: '/api/controller/v2/config/', body: undefined },
      {
        method: 'POST',
        path: '/api/controller/v2/config/subscriptions/',
        body: {
          subscriptions_username: 'user@example.com',
          subscriptions_password: 'red-hat-password',
        },
      },
      {
        method: 'POST',
        path: '/api/controller/v2/config/attach/',
        body: { subscription_id: 'sub-1' },
      },
    ]);
  });

  it('does not reattach when the controller already has a valid license', async () => {
    const calls: string[] = [];
    const result = await attachRedHatSubscription({
      controller,
      subscription,
      requestJson: async (_controller, _method, path) => {
        calls.push(path);
        return {
          license_info: {
            valid_key: true,
            license_type: 'enterprise',
            subscription_name: 'Existing subscription',
          },
        };
      },
    });

    expect(result).toEqual({
      status: 'already-attached',
      subscriptionName: 'Existing subscription',
    });
    expect(calls).toEqual(['/api/controller/v2/config/']);
  });

  it('reports when Red Hat returns no attachable subscriptions', async () => {
    await expect(attachRedHatSubscription({
      controller,
      subscription,
      requestJson: async (_controller, _method, path) => {
        if (path === '/api/controller/v2/config/') return { license_info: {} };
        return [];
      },
    })).rejects.toThrow('No attachable Red Hat Ansible Automation Platform subscription was returned.');
  });

  it('accepts a wrapped subscriptions response from the controller API', async () => {
    const result = await attachRedHatSubscription({
      controller,
      subscription,
      requestJson: async (_controller, _method, path) => {
        if (path === '/api/controller/v2/config/') return { license_info: {} };
        if (path === '/api/controller/v2/config/subscriptions/') {
          return {
            results: [
              {
                subscription_id: 'wrapped-sub-1',
                subscription_name: 'Wrapped subscription',
              },
            ],
          };
        }
        return {
          subscription_id: 'wrapped-sub-1',
          subscription_name: 'Wrapped subscription',
          valid_key: true,
        };
      },
    });

    expect(result).toEqual({
      status: 'attached',
      subscriptionName: 'Wrapped subscription',
    });
  });
});
