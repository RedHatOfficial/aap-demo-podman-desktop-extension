import { describe, expect, it } from 'vitest';
import { cleanTerminalOutput } from '../src/terminal-output';

describe('cleanTerminalOutput', () => {
  it('removes terminal control sequences from streamed command output', () => {
    expect(cleanTerminalOutput('\u001B[?2026hpulling 10%\r\u001B[?2026l\n')).toBe('pulling 10%\n\n');
  });
});
