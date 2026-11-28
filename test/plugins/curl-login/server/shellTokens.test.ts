import { describe, expect, test } from "bun:test";
import { tokenizeShell } from "../../../../packages/plugins/src/curl-login/server/shellTokens";
import { forAll, text } from "../../../support/core";

describe("posix", () => {
  const cases: [string, string[]][] = [
    ["curl 'https://a.slack.com/api/x?y=1'", ["curl", "https://a.slack.com/api/x?y=1"]],
    [`curl "a b" 'c d' e\\ f`, ["curl", "a b", "c d", "e f"]],
    [`-H 'it'\\''s'`, ["-H", "it's"]],
    [`"say \\"hi\\" \\$HOME \\\\ \\n"`, [`say "hi" $HOME \\ \\n`]],
    [`$'a\\nb\\r\\t\\'c\\\\'`, ["a\nb\r\t'c\\"]],
    [`$'\\u00e9\\x41\\101\\U0001F600'`, ["\u00e9AA\u{1F600}"]],
    [`''`, [""]],
    [`a''b""c`, ["abc"]],
    ["curl \\\n  -H 'a' \\\r\n  -d 'b'", ["curl", "-H", "a", "-d", "b"]],
    ["  \n\t ", []],
    [`'unterminated value`, ["unterminated value"]],
    [`$'unterminated \\`, ["unterminated "]],
    [`$'bad \\q \\xZZ'`, ["bad q xZZ"]],
  ];
  for (const [input, expected] of cases) {
    test(JSON.stringify(input), () => expect(tokenizeShell(input)).toEqual(expected));
  }
});

describe("windows cmd", () => {
  const cases: [string, string[]][] = [
    [
      `curl ^"https://a.slack.com/api/x^" ^\n  -H ^"accept: */*^" ^\r\n  --data-raw ^"a=1^&b=2^"`,
      ["curl", "https://a.slack.com/api/x", "-H", "accept: */*", "--data-raw", "a=1&b=2"],
    ],
    [`--data-raw ^"{^\\^"token^\\^":^\\^"xoxc-1^\\^"}^"`, ["--data-raw", `{"token":"xoxc-1"}`]],
    [`^"a ^^ b^" ^"c:\\\\^"`, ["a ^ b", "c:\\"]],
    [`^"^%PATH^%^"`, ["%PATH%"]],
  ];
  for (const [input, expected] of cases) {
    test(JSON.stringify(input), () => expect(tokenizeShell(input)).toEqual(expected));
  }
});

describe("garbage", () => {
  test("never throws and returns strings", () => {
    forAll(
      (random) => text(random, "'\"\\$^ \n\r\tab-@%`xuU01", 60),
      (input) => {
        for (const token of tokenizeShell(input)) expect(typeof token).toBe("string");
      },
      500,
    );
  });

  test("plain words round trip", () => {
    forAll(
      (random) => text(random, "ab c-\t\n", 40),
      (input) => expect(tokenizeShell(input)).toEqual(input.split(/\s+/).filter(Boolean)),
    );
  });
});
