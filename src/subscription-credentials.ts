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
