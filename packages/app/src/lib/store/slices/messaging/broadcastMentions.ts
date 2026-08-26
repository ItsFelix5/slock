const BROADCAST_MENTION_RE = /(?<![<!\w])@(channel|here)\b/gi;

export function withBroadcastMentions(text: string): { text: string; hasBroadcast: boolean } {
  let hasBroadcast = false;
  const converted = text.replace(BROADCAST_MENTION_RE, (_match, kind: string) => {
    hasBroadcast = true;
    return `<!${kind.toLowerCase()}>`;
  });
  return { hasBroadcast, text: converted };
}
