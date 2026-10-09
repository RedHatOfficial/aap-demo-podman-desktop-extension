export interface ClipboardContext {
  clipboard?: Pick<Clipboard, 'writeText'>;
  document?: Pick<Document, 'body' | 'createElement' | 'execCommand'>;
}

function defaultClipboardContext(): ClipboardContext {
  return {
    clipboard: typeof navigator === 'undefined' ? undefined : navigator.clipboard,
    document: typeof document === 'undefined' ? undefined : document,
  };
}

export async function copyText(text: string, context: ClipboardContext = defaultClipboardContext()): Promise<boolean> {
  if (context.clipboard) {
    try {
      await context.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy document-based clipboard path.
    }
  }

  const ownerDocument = context.document;
  if (!ownerDocument) return false;

  const textarea = ownerDocument.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  ownerDocument.body.append(textarea);
  textarea.select();

  try {
    return ownerDocument.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
