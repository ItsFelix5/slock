// Regular DM ids are Slack "D..." ims, recognizable on sight (see viewState's
// parseNavPath) even before any local data has loaded. Multi-person DM ids
// share private channels' "G..." namespace, so those can only be told apart
// from a channel by checking the locally-loaded dms list.
export function isDmId(id: string, isKnownDm: (id: string) => boolean): boolean {
  return id.startsWith("D") || isKnownDm(id);
}
