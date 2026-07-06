export interface User {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  initials: string;
  presence: 'active' | 'away';
}

export interface Reaction {
  name: string;
  count: number;
  users: string[];
}

export interface Message {
  id: string;
  ts: string;
  userId: string;
  text: string;
  blocks?: any[];
  time: string;
  day: string;
  replyCount?: number;
  replyUsers?: string[];
  reactions?: Reaction[];
  editedLocally?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  private: boolean;
  topic: string;
  unread: boolean;
  mentions?: number;
}

export interface DirectMessage {
  id: string;
  userId: string;
  unread: boolean;
}
