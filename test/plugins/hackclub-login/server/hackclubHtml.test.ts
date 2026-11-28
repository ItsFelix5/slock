import { describe, expect, test } from "bun:test";
import {
  extractCsrfToken,
  extractFlashError,
  extractFormFields,
  extractVisibleText,
  formAction,
} from "../../../../packages/plugins/src/hackclub-login/server/hackclubHtml";
import { forAll, text } from "../../../support/core";

const loginPage = `<!DOCTYPE html><html><head>
<meta name="csrf-token" content="meta+token/with==" />
</head><body><form action="/login" method="post">
<input type="hidden" name="authenticity_token" value="form-token" autocomplete="off" />
<input type="email" name="email" value="">
</form></body></html>`;

describe("extractCsrfToken", () => {
  test("prefers the meta tag", () => {
    expect(extractCsrfToken(loginPage)).toBe("meta+token/with==");
  });

  test("falls back to the hidden input in either attribute order", () => {
    expect(extractCsrfToken(`<input name="authenticity_token" value="a&amp;b">`)).toBe("a&b");
    expect(extractCsrfToken(`<input value="x-y" name="authenticity_token">`)).toBe("x-y");
  });

  test("throws a short error when there is no token", () => {
    expect(() => extractCsrfToken("<html></html>")).toThrow("login page");
  });

  test("decodes entities once", () => {
    expect(extractCsrfToken(`<meta name="csrf-token" content="a&amp;quot;b&#39;c">`)).toBe(
      `a&quot;b'c`,
    );
  });
});

describe("extractFlashError", () => {
  test("reads a danger banner and joins list items", () => {
    const html = `<div class="banner danger"><ul><li>Invalid <b>code</b></li><li>Try again</li></ul></div>`;
    expect(extractFlashError(html)).toBe("Invalid code; Try again");
  });

  test("handles nested divs inside the banner", () => {
    const html = `<div class="banner warning"><div>Slow <i>down</i></div></div><div>after</div>`;
    expect(extractFlashError(html)).toBe("Slow down");
  });

  test("danger wins over warning", () => {
    const html = `<div class="banner warning">warn</div><div class="banner danger">bad</div>`;
    expect(extractFlashError(html)).toBe("bad");
  });

  test("ignores unrelated divs and similar class names", () => {
    expect(extractFlashError(`<div class="banner-wide danger">x</div>`)).toBeNull();
    expect(extractFlashError(`<div class="banner info">x</div>`)).toBeNull();
  });

  test("an unclosed banner runs to the end", () => {
    expect(extractFlashError(`<div class="banner danger">oops`)).toBe("oops");
  });

  test("an empty banner is null", () => {
    expect(extractFlashError(`<div class="banner danger"> </div>`)).toBeNull();
  });
});

describe("extractVisibleText", () => {
  test("drops scripts, styles and tags", () => {
    expect(
      extractVisibleText(
        `<style>a{}</style><script>var t="xoxc-1"</script><p>Hello <b>there</b></p>`,
      ),
    ).toBe("Hello there");
  });

  test("caps at 300 characters", () => {
    expect(extractVisibleText(`<p>${"a".repeat(1000)}</p>`)).toHaveLength(300);
  });

  test("never leaks a Slack token or session cookie", () => {
    const body = "<p>token xoxc-123-abc-def and cookie xoxd-AbC%2Bdef here</p>";
    expect(extractVisibleText(body)).not.toMatch(/xox[a-z]-/);
  });

  test("never throws on garbage", () => {
    forAll(
      (random) => text(random, "<>/\"'abc &;=\n", 80),
      (html) => {
        expect(extractVisibleText(html).length).toBeLessThanOrEqual(300);
        expect(() => extractFlashError(html)).not.toThrow();
        expect(() => extractFormFields(html)).not.toThrow();
      },
    );
  });
});

describe("formAction", () => {
  test("resolves relative actions against the page url", () => {
    expect(
      formAction(`<form action="/login/abc/verify">`, "https://auth.hackclub.com/login/abc"),
    ).toBe("https://auth.hackclub.com/login/abc/verify");
  });

  test("decodes entities in the action", () => {
    expect(formAction(`<form action="/sso?a=1&amp;b=2">`, "https://x.slack.com/")).toBe(
      "https://x.slack.com/sso?a=1&b=2",
    );
  });

  test("uses the page itself when there is no action", () => {
    expect(formAction(`<form method="post">`, "https://x.slack.com/a")).toBe(
      "https://x.slack.com/a",
    );
  });
});

describe("extractFormFields", () => {
  test("collects named inputs and decodes values", () => {
    const html = `<form><input type="hidden" name="SAMLResponse" value="PHNhbWw+&#39;x&#39;==">
      <input type="hidden" name="RelayState" value="">
      <input type="submit" value="Continue"></form>`;
    expect(extractFormFields(html)).toEqual({ RelayState: "", SAMLResponse: "PHNhbWw+'x'==" });
  });

  test("does not mistake data attributes for name or value", () => {
    const html = `<input data-name="wrong" name="real" data-value="nope" value="yes">`;
    expect(extractFormFields(html)).toEqual({ real: "yes" });
  });
});
