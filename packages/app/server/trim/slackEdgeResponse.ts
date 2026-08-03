// biome-ignore-all lint/style/useNamingConvention: Mirrors Slack's wire field names.

import { trimChannel, trimUser } from "./slackEntities.ts";

function trimUsergroup(group: any): any {
  if (!group || typeof group !== "object") return group;
  return {
    created_by: group.created_by,
    date_create: group.date_create,
    description: group.description,
    handle: group.handle,
    id: group.id,
    is_section: group.is_section,
    name: group.name,
    prefs: { channels: group.prefs?.channels, groups: group.prefs?.groups },
    user_count: group.user_count,
  };
}

function mapRecordValues(record: any, trim: (value: any) => any): any {
  if (!(record && typeof record === "object") || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, trim(value)]));
}

export function trimSlackEdgeResponse(method: string, data: any): any {
  if (!data?.ok) return data;
  if (method === "channels/info") {
    return {
      channel: data.channel ? trimChannel(data.channel) : undefined,
      channels: Array.isArray(data.channels)
        ? data.channels.map(trimChannel)
        : mapRecordValues(data.channels, trimChannel),
      ok: true,
      results: Array.isArray(data.results)
        ? data.results.map(trimChannel)
        : mapRecordValues(data.results, trimChannel),
    };
  }
  if (method === "users/info") {
    return {
      ok: true,
      results: Array.isArray(data.results)
        ? data.results.map(trimUser)
        : mapRecordValues(data.results, trimUser),
      user: data.user ? trimUser(data.user) : undefined,
      users: Array.isArray(data.users)
        ? data.users.map(trimUser)
        : mapRecordValues(data.users, trimUser),
    };
  }
  if (method === "users/list") {
    return {
      next_marker: data.next_marker,
      ok: true,
      results: Array.isArray(data.results) ? data.results.map(trimUser) : data.results,
    };
  }
  if (method === "usergroups/info") {
    return {
      ok: true,
      results: Array.isArray(data.results) ? data.results.map(trimUsergroup) : data.results,
      usergroup: data.usergroup ? trimUsergroup(data.usergroup) : undefined,
      usergroups: Array.isArray(data.usergroups)
        ? data.usergroups.map(trimUsergroup)
        : mapRecordValues(data.usergroups, trimUsergroup),
    };
  }
  return data;
}
