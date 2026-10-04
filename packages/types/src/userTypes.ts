export interface UserCustomField {
  alt?: string;
  id: string;
  value: string;
}

export interface UserProfile {
  customFields?: UserCustomField[];
  startDate?: string;
}

export interface User {
  appId?: string;
  avatarColor: string;
  avatarUrl?: string;
  botId?: string;
  customFields?: UserCustomField[];
  email?: string;
  id: string;
  isBot?: boolean;

  isWorkspaceAdmin?: boolean;

  lastSeen?: number;
  name: string;
  originalName?: string;
  phone?: string;

  presence?: "active" | "away";
  pronouns?: string;
  realName?: string;
  startDate?: string;
  statusEmoji?: string;
  statusText?: string;
  title?: string;
  tz?: string;
  tzLabel?: string;
}

export interface Usergroup {
  id: string;

  name: string;
}

export interface UsergroupDetails {
  channelIds: string[];
  createdBy?: string;
  dateCreate?: number;
  description: string;
  handle: string;
  id: string;
  isSection: boolean;
  memberCount: number;
  memberIds: string[];
  title: string;
}

export interface ProfileFieldDef {
  fieldName?: string;
  id: string;
  label: string;
  type?: string;
}
