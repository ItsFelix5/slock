import type { RawChannel, RawCountGroup, RawUser } from "./rawTypes";

export interface RawBootIm {
  created?: number;
  id: string;
  is_open?: boolean;
  updated?: number;
  user?: string;
}

export interface BootstrapSection {
  channel_ids?: string[];
  filtering?: string;
  name?: string;
  type?: string;
}

export interface BootstrapPayload {
  channel_sections?: string;
  channels?: RawChannel[];
  emoji_use?: string;
  error?: Record<string, string>;
  frecency?: string;
  frecency_ent_jumper?: string;
  frecency_jumper?: string;
  ims?: RawBootIm[];
  is_open?: string[];
  mpims?: RawChannel[];
  muted_channels?: string;
  notification_prefs?: string;
  notifications?: Record<string, number>;
  retry_after?: Record<string, string>;
  sections?: Record<string, BootstrapSection>;
  self?: RawUser;
  snooze?: { endtime?: number } | null;
  starred?: (string | { channel?: string; id?: string })[];
  subteams?: { all?: string[]; self?: string[] };
  unreads?: {
    channels?: RawCountGroup[];
    ims?: RawCountGroup[];
    mpims?: RawCountGroup[];
  };
}
