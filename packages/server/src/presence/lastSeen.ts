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
