import { describe, expect, it } from 'vitest';
import { getExternalOpenCommand } from '../src/external-open';

describe('getExternalOpenCommand', () => {
  it('uses the macOS default browser opener', () => {
    expect(getExternalOpenCommand('https://example.test', 'darwin')).toEqual({
      command: 'open',
      args: ['https://example.test'],
    });
  });

  it('uses the Linux default browser opener', () => {
    expect(getExternalOpenCommand('https://example.test', 'linux')).toEqual({
      command: 'xdg-open',
      args: ['https://example.test'],
    });
  });

  it('uses the Windows URL handler without a shell', () => {
    expect(getExternalOpenCommand('https://example.test', 'win32')).toEqual({
      command: 'rundll32.exe',
      args: ['url.dll,FileProtocolHandler', 'https://example.test'],
    });
  });
});
