const BELOW_TWENTY = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const GROUPS = [
  "",
  "thousand",
  "million",
  "billion",
  "trillion",
  "quadrillion",
  "quintillion",
  "sextillion",
  "septillion",
  "octillion",
  "nonillion",
  "decillion",
  "undecillion",
  "duodecillion",
  "tredecillion",
  "quattuordecillion",
  "quindecillion",
  "sexdecillion",
  "septendecillion",
  "octodecillion",
  "novemdecillion",
  "vigintillion",
  "unvigintillion",
  "duovigintillion",
  "trevigintillion",
  "quattuortillion",
  "quinvigintillion",
  "sexvigintillion",
  "septenvigintillion",
  "octovigintillion",
  "novemvigintillion",
  "trigintillion",
  "untrigintillion",
  "duotrigintillion",
  "trestrigintillion",
  "quattuortrigintillion",
  "quintrigintillion",
  "sextrigintillion",
  "septentrigintillion",
  "octotrigintillion",
  "novemtrigintillion",
  "quadragintillion",
  "unquadragintillion",
  "duoquadragintillion",
  "trequadragintillion",
  "quattuorquadragintillion",
  "quinquadragintillion",
  "sesquadragintillion",
  "septenquadragintillion",
  "octoquadragintillion",
  "novenquadragintillion",
  "quinquagintillion",
];

const wordAt = (words: string[], index: number) => words[index] ?? "";

function belowHundred(n: number): string {
  if (n < 20) return wordAt(BELOW_TWENTY, n);
  const ones = n % 10;
  return `${wordAt(TENS, Math.floor(n / 10))}${ones ? `-${wordAt(BELOW_TWENTY, ones)}` : ""}`;
}

function belowThousand(n: number): string {
  if (n < 100) return belowHundred(n);
  const hundreds = `${wordAt(BELOW_TWENTY, Math.floor(n / 100))} hundred`;
  return n % 100 ? `${hundreds} and ${belowHundred(n % 100)}` : hundreds;
}

export function humanize(digits: string) {
  let rest = BigInt(digits);
  if (rest === 0n) return "zero";
  const parts: string[] = [];
  let joinWithAnd = false;
  for (let group = 0; rest > 0n; group++, rest /= 1000n) {
    const chunk = Number(rest % 1000n);
    if (!chunk) continue;
    if (group === 0 && chunk < 100) joinWithAnd = true;
    else if (GROUPS[group]) {
      const conjunction = parts.length ? (joinWithAnd ? " and" : ",") : "";
      parts.push(`${GROUPS[group]}${conjunction}`);
    }
    parts.push(belowThousand(chunk));
  }
  return parts.reverse().join(" ");
}
