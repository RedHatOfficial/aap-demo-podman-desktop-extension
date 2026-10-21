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

export function hasUsableSubscriptionCredentials(contents: string): boolean {
  const username = contents.match(/^username:\s*'((?:''|[^'])*)'\s*$/m)?.[1];
  const password = contents.match(/^password:\s*'((?:''|[^'])*)'\s*$/m)?.[1];
  return Boolean(username?.replaceAll("''", "'").trim() && password?.replaceAll("''", "'").trim());
}
