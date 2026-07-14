// Recognizes any link to a user's Slack team profile — both ones the
// composer's "@/" silent-mention trigger produces (see packages/app's
// suggestionController) and ones pasted in from Slack itself (e.g. via
// "Copy link" on a profile), on either the plain "*.slack.com" or Grid
// "*.enterprise.slack.com" host form. None of these ever ping anyone (unlike
// a real `<@USERID>` mention), so any of them render as the same grey chip.
// Shared between mrkdwn.tsx (plain-text messages) and RichText.tsx (rich_text
// blocks), which both need to tell these apart from ordinary links.
const USER_PROFILE_LINK_RE =
  /^https:\/\/[a-z0-9-]+(?:\.enterprise)?\.slack\.com\/team\/([A-Z0-9]+)(?:[/?#].*)?$/i;

export function parseUserProfileLink(url: string): string | null {
  return USER_PROFILE_LINK_RE.exec(url)?.[1] ?? null;
}
