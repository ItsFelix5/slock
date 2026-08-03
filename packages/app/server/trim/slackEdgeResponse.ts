// Every edge method previously handled here (channels/info, users/list,
// users/info, usergroups/info) now has its own purpose-built route and has
// been removed from SLACK_EDGE_OPERATIONS. This function - and the generic
// /api/edge-operations/:method passthrough that's its only caller - are dead
// code kept only until Phase 19 deletes them outright.
export function trimSlackEdgeResponse(_method: string, data: any): any {
  return data;
}
