export interface InlineDialect {
  bold: string;
  italic: string;
  strike: string;

  quotePrefix: string;
}
export const MRKDWN_DIALECT: InlineDialect = {
  bold: "*",
  italic: "_",
  quotePrefix: "&gt;",
  strike: "~",
};
