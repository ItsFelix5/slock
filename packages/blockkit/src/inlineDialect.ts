// Slack messages and mentions use mrkdwn (single-char *bold*/~strike~); Slack
// canvases store real markdown (**bold**/~~strike~~) instead — everything
// else that deals with dialects (headers, quotes, lists, dividers, code
// fences, the <...> token syntax for mentions/channels/dates/links) is
// identical between the two, so only the inline mark delimiters vary.
export interface InlineDialect {
  bold: string;
  italic: string;
  strike: string;
  // Slack chat text HTML-entity-escapes its blockquote marker (`&gt;`) along
  // with the rest of the text's `<`/`>`/`&`; a canvas's markdown document is
  // plain text with no such escaping, so its quotes use a literal `>`.
  quotePrefix: string;
}
export const MRKDWN_DIALECT: InlineDialect = {
  bold: "*",
  italic: "_",
  quotePrefix: "&gt;",
  strike: "~",
};
export const MARKDOWN_DIALECT: InlineDialect = {
  bold: "**",
  italic: "_",
  quotePrefix: ">",
  strike: "~~",
};
