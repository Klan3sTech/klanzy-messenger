export type ChatKind = "direct" | "group" | "channel" | "bot";
export type AttachmentKind = "Фото" | "Видео" | "Файл" | "Музыка";
export type ThemeMode = "light" | "dark" | "auto";

export type UserProfile = {
  id?: string;
  nickname: string;
  username: string;
  email?: string;
  avatar?: string;
  badge?: string;
  banned?: boolean;
  createdAt?: number;
};

export type DeviceSession = {
  id: string;
  deviceName: string;
  lastSeenAt: number;
  createdAt: number;
};

export type Message = {
  id: string;
  sender: "me" | "other";
  senderId?: string;
  senderUsername?: string;
  senderNickname?: string;
  text: string;
  createdAt: string; // "HH:MM"
  ts: number;
  attachment?: AttachmentKind;
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentMime?: string;
  /** emoji → список username, кто поставил */
  reactions?: Record<string, string[]>;
};

export type ChatItem = {
  id: string;
  title: string;
  username?: string;
  kind: ChatKind;
  visibility: "open" | "private";
  subscribed?: boolean;
  ownerUsername?: string;
  avatar?: string;
  pinned?: boolean;
  muted?: boolean;
  unread?: number;
  createdAt?: number;
  messages: Message[];
};

export type ChatAdminEntry = { chatId: string; username: string };
export type BlockEntry = { blockerUsername: string; blockedUsername: string };

export type BootstrapPayload = {
  users: UserProfile[];
  chats: ChatItem[];
  blocks?: BlockEntry[];
  chatAdmins?: ChatAdminEntry[];
  sessions?: DeviceSession[];
};

export type Section = "chats" | "channels" | "groups" | "bots";
