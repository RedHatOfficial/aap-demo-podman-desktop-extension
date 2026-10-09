import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/webview/clipboard';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

function restoreGlobal(name: 'navigator' | 'document', descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete (globalThis as Record<string, unknown>)[name];
}

afterEach(() => {
  restoreGlobal('navigator', originalNavigator);
  restoreGlobal('document', originalDocument);
});

describe('copyText', () => {
  it('uses the Clipboard API when it succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    await expect(copyText('https://example.test/aap')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.test/aap');
  });

  it('falls back to a temporary textarea when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    const textarea = {
      value: '',
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      remove: vi.fn(),
    };
    const execCommand = vi.fn().mockReturnValue(true);
    const appendChild = vi.fn();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText } },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { appendChild },
        createElement: vi.fn().mockReturnValue(textarea),
        execCommand,
      },
    });

    await expect(copyText('secret-value', 'credential password')).resolves.toBe(true);
    expect(textarea.value).toBe('secret-value');
    expect(appendChild).toHaveBeenCalledWith(textarea);
    expect(textarea.select).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(textarea.remove).toHaveBeenCalled();
  });

  it('returns false when clipboard mechanisms are missing or fail', async () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    await expect(copyText('missing')).resolves.toBe(false);

    const textarea = { value: '', style: {}, focus: vi.fn(), select: vi.fn(), remove: vi.fn() };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        body: { appendChild: vi.fn() },
        createElement: vi.fn().mockReturnValue(textarea),
        execCommand: vi.fn().mockReturnValue(false),
      },
    });
    await expect(copyText('failed')).resolves.toBe(false);
  });
});
