// client.userBoot/client.counts/users.prefs.get were the last methods
// handled here - bootstrap.ts now calls fetchSlack + its own trim functions
// directly instead of going through the auto-trimming callSlack path. This
// function - and trimSlackResponse's call to it, its only caller - are dead
// code kept only until Phase 19 deletes them outright.
export function trimReadResponse(_method: string, _data: any): any | null {
  return null;
}
