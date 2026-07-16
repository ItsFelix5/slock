import type { ProfileFieldDef, User } from "../../types";
import { mapUser } from "../mappers";
import { callSlack, callSlackEdge } from "../relay";

export async function fetchUser(id: string): Promise<User | null> {
  // The normal Web API users.info endpoint is restricted on Enterprise Grid.
  // The cache endpoint accepts the ids it should refresh as a timestamp map;
  // zero deliberately requests the complete current record.
  const data = await callSlackEdge("users/info", {
    include_profile_only_users: true,
    updated_ids: { [id]: 0 },
  });
  if (!data.ok) return null;
  // Cache responses have appeared as both an id-keyed `users` object and a
  // result array. Retain `user` as a fallback for compatible relay responses.
  const raw =
    data.users?.[id] ??
    data.results?.find((user: any) => user.id === id) ??
    data.users?.find?.((user: any) => user.id === id) ??
    data.user;
  return raw ? mapUser(raw) : null;
}

// team.profile.get's field *definitions* (label/ordering) are workspace-wide and
// separate from each user's field *values* (see mapUser's customFields) — fetched
// once and joined against a user's values at render time. Some workspaces restrict
// this to admins, so a failure degrades to "no custom fields shown".
export async function fetchProfileFieldDefs(): Promise<ProfileFieldDef[]> {
  try {
    const data = await callSlack("team.profile.get");
    if (!data.ok) return [];
    const fields: any[] = data.profile?.fields ?? [];
    return fields
      .filter((f) => !f.is_hidden)
      .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
      .map((f) => ({ id: f.id, label: f.label }));
  } catch {
    return [];
  }
}

export async function setStatus(text: string, emoji: string, expiration: number): Promise<void> {
  const profile = JSON.stringify({
    status_emoji: emoji,
    status_expiration: expiration,
    status_text: text,
  });
  const data = await callSlack("users.profile.set", { profile });
  if (!data.ok) throw new Error(data.error ?? "users.profile.set failed");
}

export async function setProfileFields(fields: {
  displayName?: string;
  title?: string;
  pronouns?: string;
  customFields?: Record<string, string>;
}): Promise<void> {
  const profile: Record<string, unknown> = {};
  if (fields.displayName !== undefined) profile.display_name = fields.displayName;
  if (fields.title !== undefined) profile.title = fields.title;
  if (fields.pronouns !== undefined) profile.pronouns = fields.pronouns;
  if (fields.customFields) {
    profile.fields = Object.fromEntries(
      Object.entries(fields.customFields).map(([id, value]) => [id, { alt: "", value }]),
    );
  }
  const data = await callSlack("users.profile.set", { profile: JSON.stringify(profile) });
  if (!data.ok) throw new Error(data.error ?? "users.profile.set failed");
}

export async function setPresence(presence: "auto" | "away"): Promise<void> {
  const data = await callSlack("users.setPresence", { presence });
  if (!data.ok) throw new Error(data.error ?? "users.setPresence failed");
}
