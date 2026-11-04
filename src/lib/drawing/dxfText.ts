// Turns a DXF's text encodings into what a reader expects to see. Output is
// only ever rendered as an SVG <text> child, never as HTML.

const SPECIAL_CODES: Record<string, string> = { d: '°', c: '⌀', p: '±', '%': '%', u: '', o: '', k: '' };
const SPECIAL_CODE_PATTERN = /%%([dcpuok%])/gi;
const UNICODE_ESCAPE_PATTERN = /^\+([0-9a-f]{4})/i;
const UNICODE_ESCAPE_LENGTH = 5;
const STACK_SEPARATOR_PATTERN = /[\^#]/g;

/** Inline codes with a value running to the next `;` (font, height, colour…). */
const VALUE_CODES = new Set(['A', 'C', 'c', 'F', 'f', 'H', 'Q', 'T', 'W', 'p']);
/** Inline on/off toggles (underline, overline, strike-through). */
const TOGGLE_CODES = new Set(['L', 'l', 'O', 'o', 'K', 'k']);
const LITERAL_CODES = new Set(['\\', '{', '}']);

/** `%%d` and friends, used by TEXT and MTEXT alike. */
export function decodeDxfText(raw: string): string {
  return raw.replace(SPECIAL_CODE_PATTERN, (_match, code: string) => SPECIAL_CODES[code.toLowerCase()]);
}

/** An MTEXT value with its inline formatting removed, one entry per line:
 *  `\A1;\A1;91{\H1x;\S7/32;}"` → `91 7/32"`. */
export function decodeMtext(raw: string): string[] {
  let out = '';
  let i = 0;
  const skipPastSemicolon = (from: number) => {
    const end = raw.indexOf(';', from);
    return end === -1 ? raw.length : end + 1;
  };

  while (i < raw.length) {
    const char = raw[i];
    if (char === '{' || char === '}') {
      i += 1;
    } else if (char !== '\\' || i + 1 >= raw.length) {
      out += char;
      i += 1;
    } else {
      const code = raw[i + 1];
      const afterCode = i + 2;
      if (code === 'P') {
        out += '\n';
        i = afterCode;
      } else if (code === 'S') {
        const end = skipPastSemicolon(afterCode);
        const stacked = raw.slice(afterCode, end).replace(';', '').replace(STACK_SEPARATOR_PATTERN, '/');
        // "91" + "7/32" reads as one mixed number only with a space between.
        out += (/\d$/.test(out) ? ' ' : '') + stacked;
        i = end;
      } else if (VALUE_CODES.has(code)) {
        i = skipPastSemicolon(afterCode);
      } else if (TOGGLE_CODES.has(code)) {
        i = afterCode;
      } else if (code === '~') {
        out += ' ';
        i = afterCode;
      } else if (LITERAL_CODES.has(code)) {
        out += code;
        i = afterCode;
      } else if (code === 'U' && UNICODE_ESCAPE_PATTERN.test(raw.slice(afterCode, afterCode + UNICODE_ESCAPE_LENGTH))) {
        const hex = raw.slice(afterCode + 1, afterCode + UNICODE_ESCAPE_LENGTH);
        out += String.fromCharCode(Number.parseInt(hex, 16));
        i = afterCode + UNICODE_ESCAPE_LENGTH;
      } else {
        out += char;
        i += 1;
      }
    }
  }
  return decodeDxfText(out).split('\n').map((line) => line.trim());
}

/** R14 files are usually Windows-1252 (`$DWGCODEPAGE ansi_1252`), newer ones UTF-8. */
export function decodeDxfBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
