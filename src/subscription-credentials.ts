function quoteYamlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function formatSubscriptionCredentials(username: string, password: string): string {
  return [
    `username: ${quoteYamlString(username.trim())}`,
    `password: ${quoteYamlString(password)}`,
    '',
  ].join('\n');
}

export interface SubscriptionCredentials {
  username: string;
  password: string;
}

export function parseSubscriptionCredentials(contents: string): SubscriptionCredentials | undefined {
  const username = contents.match(/^username:\s*'((?:''|[^'])*)'\s*$/m)?.[1];
  const password = contents.match(/^password:\s*'((?:''|[^'])*)'\s*$/m)?.[1];
  const parsedUsername = username?.replaceAll("''", "'").trim();
  const parsedPassword = password?.replaceAll("''", "'");
  if (!parsedUsername || !parsedPassword?.trim()) return undefined;
  return {
    username: parsedUsername,
    password: parsedPassword,
  };
}

export function hasUsableSubscriptionCredentials(contents: string): boolean {
  return Boolean(parseSubscriptionCredentials(contents));
}
