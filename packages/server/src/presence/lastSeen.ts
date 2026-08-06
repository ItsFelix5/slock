// In-memory only — resets on restart. An explicit exception to "the server
// shouldn't store anything": Slack's API exposes no last-seen timestamp, so
// this is the only way to offer one, sourced from presence_change events we
// already see flowing through the gateway relay.
const lastSeenByKey = new Map<string, number>();

function keyFor(teamId: string, userId: string): string {
  return `${teamId}:${userId}`;
}

export function recordSeenActive(teamId: string, userId: string): void {
  lastSeenByKey.set(keyFor(teamId, userId), Date.now());
}

export function getLastSeen(teamId: string, userId: string): number | undefined {
  return lastSeenByKey.get(keyFor(teamId, userId));
}
