const WHITESPACE = /\s/;
const ANSI_C_SIMPLE: Record<string, string> = {
  "\\": "\\",
  "'": "'",
  '"': '"',
  "?": "?",
  a: "\x07",
  b: "\b",
  e: "\x1b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};
const ANSI_C_NUMERIC =
  /^(?:x([0-9a-fA-F]{1,2})|u([0-9a-fA-F]{1,4})|U([0-9a-fA-F]{1,8})|([0-7]{1,3}))/;
const DOUBLE_QUOTE_ESCAPABLE = new Set(["\\", '"', "$", "`"]);
const CARET_CONTINUATION = /\^\r?\n/g;
const CARET_ESCAPE = /\^([\s\S])/g;
const SHELL_CONTINUATION = /\\\r?\n/g;
const BACKTICK_CONTINUATION = /`\r?\n/g;

type Cursor = { text: string; index: number };

function readAnsiC(cursor: Cursor): string {
  let out = "";
  const { text } = cursor;
  while (cursor.index < text.length) {
    const char = text.charAt(cursor.index++);
    if (char === "'") return out;
    if (char !== "\\") {
      out += char;
      continue;
    }
    const escaped = text.charAt(cursor.index);
    const simple = ANSI_C_SIMPLE[escaped];
    if (simple !== undefined) {
      out += simple;
      cursor.index++;
      continue;
    }
    const numeric = text.slice(cursor.index, cursor.index + 10).match(ANSI_C_NUMERIC);
    const digits = numeric?.[1] ?? numeric?.[2] ?? numeric?.[3] ?? numeric?.[4];
    const code = digits === undefined ? Number.NaN : Number.parseInt(digits, numeric?.[4] ? 8 : 16);
    if (Number.isNaN(code) || code > 0x10ffff) {
      out += escaped;
      cursor.index++;
      continue;
    }
    out += String.fromCodePoint(code);
    cursor.index += numeric?.[0].length ?? 0;
  }
  return out;
}

function readDoubleQuoted(cursor: Cursor): string {
  let out = "";
  const { text } = cursor;
  while (cursor.index < text.length) {
    const char = text.charAt(cursor.index++);
    if (char === '"') return out;
    const next = text.charAt(cursor.index);
    if (char === "\\" && DOUBLE_QUOTE_ESCAPABLE.has(next)) {
      out += next;
      cursor.index++;
    } else out += char;
  }
  return out;
}

function readSingleQuoted(cursor: Cursor): string {
  const end = cursor.text.indexOf("'", cursor.index);
  const stop = end === -1 ? cursor.text.length : end;
  const out = cursor.text.slice(cursor.index, stop);
  cursor.index = stop + 1;
  return out;
}

function tokenizePosix(text: string): string[] {
  const tokens: string[] = [];
  const cursor: Cursor = { index: 0, text: text.replace(SHELL_CONTINUATION, " ") };
  let current = "";
  let inToken = false;
  const flush = () => {
    if (inToken) tokens.push(current);
    current = "";
    inToken = false;
  };
  while (cursor.index < cursor.text.length) {
    const char = cursor.text.charAt(cursor.index++);
    if (WHITESPACE.test(char)) {
      flush();
      continue;
    }
    inToken = true;
    if (char === "'") current += readSingleQuoted(cursor);
    else if (char === '"') current += readDoubleQuoted(cursor);
    else if (char === "$" && cursor.text.charAt(cursor.index) === "'") {
      cursor.index++;
      current += readAnsiC(cursor);
    } else if (char === "\\") current += cursor.text.charAt(cursor.index++);
    else current += char;
  }
  flush();
  return tokens;
}

function tokenizeWindows(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inToken = false;
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text.charAt(index);
    if (char === "\\") {
      let slashes = 0;
      while (text.charAt(index) === "\\") {
        slashes++;
        index++;
      }
      inToken = true;
      if (text.charAt(index) === '"') {
        current += "\\".repeat(Math.floor(slashes / 2));
        if (slashes % 2 === 1) current += '"';
        else quoted = !quoted;
      } else {
        current += "\\".repeat(slashes);
        index--;
      }
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      inToken = true;
    } else if (!quoted && WHITESPACE.test(char)) {
      if (inToken) tokens.push(current);
      current = "";
      inToken = false;
    } else {
      current += char;
      inToken = true;
    }
  }
  if (inToken) tokens.push(current);
  return tokens;
}

export function tokenizeShell(raw: string): string[] {
  const text = raw.trim();
  if (text.includes('^"')) {
    return tokenizeWindows(text.replace(CARET_CONTINUATION, " ").replace(CARET_ESCAPE, "$1"));
  }
  return tokenizePosix(text.replace(BACKTICK_CONTINUATION, " "));
}
