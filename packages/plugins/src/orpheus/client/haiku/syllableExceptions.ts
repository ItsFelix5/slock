import raw from "./syllableExceptions.txt";

const WHITESPACE = /\s+/;

export default new Map<string, number>(
  raw.split("\n").flatMap((line) => {
    const [word, count] = line.trim().split(WHITESPACE);
    return word ? [[word.toLowerCase(), Number.parseInt(count ?? "", 10) || 0]] : [];
  }),
);
