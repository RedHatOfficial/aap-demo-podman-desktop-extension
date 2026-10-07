function stripAnsiEscapeSequences(text: string): string {
  let output = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) !== 0x1b) {
      output += text[index];
      continue;
    }

    const kind = text[index + 1];
    if (kind === '[') {
      index += 2;
      while (index < text.length && !(text.charCodeAt(index) >= 0x40 && text.charCodeAt(index) <= 0x7e)) {
        index += 1;
      }
      continue;
    }

    if (kind === ']') {
      index += 2;
      while (index < text.length) {
        if (text.charCodeAt(index) === 0x07) break;
        if (text.charCodeAt(index) === 0x1b && text[index + 1] === '\\') {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }
  }
  return output;
}

export function cleanTerminalOutput(text: string): string {
  return stripAnsiEscapeSequences(text)
    .replace(/\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}
