export function isValidPullSecret(contents: string): boolean {
  if (!contents.trim()) return false;

  try {
    const parsed = JSON.parse(contents.replace(/^\uFEFF/, '')) as {
      auths?: unknown;
    };
    return typeof parsed === 'object'
      && parsed !== null
      && typeof parsed.auths === 'object'
      && parsed.auths !== null
      && !Array.isArray(parsed.auths);
  } catch {
    return false;
  }
}
