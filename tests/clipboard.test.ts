import { describe, expect, it, vi } from 'vitest';
import { copyText } from '../src/webview/clipboard';

function createFallbackDocument(execResult: boolean) {
  const textareas: Array<{ value: string; remove: ReturnType<typeof vi.fn> }> = [];
  const execCommand = vi.fn(() => execResult);
  const document = {
    body: {
      append: (textarea: { value: string; remove: ReturnType<typeof vi.fn> }) => {
        textareas.push(textarea);
      },
    },
    createElement: () => {
      const textarea = {
        value: '',
        style: { opacity: '', position: '' },
        setAttribute: vi.fn(),
        select: vi.fn(),
        remove: vi.fn(),
      };
      textareas.push(textarea);
      return textarea;
    },
    execCommand,
  } as unknown as Pick<Document, 'body' | 'createElement' | 'execCommand'>;

  return { document, execCommand, textareas };
}

describe('copyText', () => {
  it('copies with the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(copyText('https://example.test', { clipboard: { writeText } })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.test');
  });

  it('falls back to a temporary textarea when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    const fallback = createFallbackDocument(true);

    await expect(copyText('https://example.test', { clipboard: { writeText }, document: fallback.document })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.test');
    expect(fallback.execCommand).toHaveBeenCalledWith('copy');
    expect(fallback.textareas[0]?.remove).toHaveBeenCalled();
  });

  it('returns false when no clipboard mechanism succeeds', async () => {
    const fallback = createFallbackDocument(false);

    await expect(copyText('secret', { document: fallback.document })).resolves.toBe(false);
    expect(fallback.execCommand).toHaveBeenCalledWith('copy');
  });
});
