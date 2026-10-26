import * as https from 'node:https';
import type { SubscriptionCredentials } from './subscription-credentials';

export interface ControllerCredentials {
  url: string;
  username: string;
  password: string;
}

export interface AttachRedHatSubscriptionOptions {
  controller: ControllerCredentials;
  subscription: SubscriptionCredentials;
  requestJson?: JsonRequester;
}

export type AttachRedHatSubscriptionResult =
  | { status: 'already-attached'; subscriptionName?: string }
  | { status: 'attached'; subscriptionName?: string };

interface ControllerConfig {
  license_info?: {
    valid_key?: boolean;
    license_type?: string;
    subscription_name?: string;
  };
}

interface RedHatSubscription {
  subscription_id?: string;
  subscription_name?: string;
  product_name?: string;
  valid_key?: boolean;
}

type JsonRequester = (
  controller: ControllerCredentials,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
) => Promise<unknown>;

function isLicensed(config: ControllerConfig): boolean {
  const license = config.license_info;
  return Boolean(license?.valid_key && license.license_type !== 'UNLICENSED');
}

function subscriptionLabel(subscription: RedHatSubscription | undefined): string | undefined {
  return subscription?.subscription_name || subscription?.product_name;
}

function selectSubscription(response: unknown): RedHatSubscription | undefined {
  if (!Array.isArray(response)) return undefined;
  return response.find((subscription): subscription is RedHatSubscription => {
    return Boolean(
      subscription
      && typeof subscription === 'object'
      && 'subscription_id' in subscription
      && typeof subscription.subscription_id === 'string'
      && subscription.subscription_id.trim(),
    );
  });
}

function normalizeControllerUrl(url: string): URL {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('AAP route is missing.');
  return new URL(trimmed.endsWith('/') ? trimmed : `${trimmed}/`);
}

export function requestControllerJson(
  controller: ControllerCredentials,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(path.replace(/^\//, ''), normalizeControllerUrl(controller.url));
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const authorization = Buffer
    .from(`${controller.username}:${controller.password}`, 'utf8')
    .toString('base64');

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method,
        rejectUnauthorized: false,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${authorization}`,
          ...(payload
            ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
            : {}),
        },
      },
      response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('error', reject);
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed: unknown;
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            parsed = { error: text.trim() || response.statusMessage };
          }
          const statusCode = response.statusCode ?? 0;
          if (statusCode >= 200 && statusCode < 300) {
            resolve(parsed);
            return;
          }
          const errorText = typeof parsed === 'object' && parsed && 'error' in parsed
            ? String(parsed.error)
            : `HTTP ${statusCode}`;
          reject(new Error(errorText));
        });
      },
    );
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

export async function attachRedHatSubscription({
  controller,
  subscription,
  requestJson = requestControllerJson,
}: AttachRedHatSubscriptionOptions): Promise<AttachRedHatSubscriptionResult> {
  const currentConfig = await requestJson(
    controller,
    'GET',
    '/api/controller/v2/config/',
  ) as ControllerConfig;
  if (isLicensed(currentConfig)) {
    return {
      status: 'already-attached',
      subscriptionName: currentConfig.license_info?.subscription_name,
    };
  }

  const availableSubscriptions = await requestJson(
    controller,
    'POST',
    '/api/controller/v2/config/subscriptions/',
    {
      subscriptions_username: subscription.username,
      subscriptions_password: subscription.password,
    },
  );
  const selectedSubscription = selectSubscription(availableSubscriptions);
  if (!selectedSubscription?.subscription_id) {
    throw new Error('No attachable Red Hat Ansible Automation Platform subscription was returned.');
  }

  const attachedSubscription = await requestJson(
    controller,
    'POST',
    '/api/controller/v2/config/attach/',
    { subscription_id: selectedSubscription.subscription_id },
  ) as RedHatSubscription;

  return {
    status: 'attached',
    subscriptionName: subscriptionLabel(attachedSubscription) ?? subscriptionLabel(selectedSubscription),
  };
}
