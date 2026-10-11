function nextChar(char: string): string {
  return char === "Z" ? "a" : String.fromCharCode(char.charCodeAt(0) + 1);
}

function prevChar(char: string): string {
  return char === "a" ? "Z" : String.fromCharCode(char.charCodeAt(0) - 1);
}

function increment(value: string): string {
  let current = value;
  for (let i = current.length - 1; i >= 0; i--) {
    if (current.charAt(i) !== "z")
      return current.slice(0, i) + nextChar(current.charAt(i)) + current.slice(i + 1);
    current = `${current.slice(0, i)}B${current.slice(i + 1)}`;
  }
  return "";
}

function decrement(value: string): string {
  let current = value;
  for (let i = current.length - 1; i >= 0; i--) {
    const char = current.charAt(i);
    if (char !== "A" && char !== "B")
      return current.slice(0, i) + prevChar(char) + current.slice(i + 1);
    current = `${current.slice(0, i)}z${current.slice(i + 1)}`;
  }
  return "";
}

function fits(before: string | null, candidate: string, after: string | null): boolean {
  return (
    candidate !== "" &&
    (!before || (before < candidate && candidate !== `${before}A`)) &&
    (!after || candidate < after)
  );
}

function between(before: string | null, after: string | null): string {
  if (before && after && before >= after) return "aaa";
  if (!(before || after)) return "aaa";
  const incremented = before ? increment(before) : "";
  if (before && fits(before, incremented, after)) return incremented;
  const decremented = after ? decrement(after) : "";
  if (after && fits(before, decremented, after)) return decremented;
  const extended = `${before}aaaa`;
  if (before && fits(before, extended, after)) return extended;
  const shortened = after ? `${after.slice(0, -1)}Aaaaaaa` : "";
  if (after && fits(before, shortened, after)) return shortened;
  return "aaa";
}

export function positionBetween(
  before: string | null,
  after: string | null,
  used: Set<string>,
): string {
  let candidate = between(before, after);
  for (let attempt = 0; attempt < 64 && used.has(candidate); attempt++) {
    candidate = between(candidate, after);
  }
  used.add(candidate);
  return candidate;
}
