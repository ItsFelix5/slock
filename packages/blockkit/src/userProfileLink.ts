const USER_PROFILE_LINK_RE =
  /^https:\/\/[a-z0-9-]+(?:\.enterprise)?\.slack\.com\/team\/([A-Z0-9]+)(?:[/?#].*)?$/i;

export function parseUserProfileLink(url: string): string | null {
  return USER_PROFILE_LINK_RE.exec(url)?.[1] ?? null;
}
