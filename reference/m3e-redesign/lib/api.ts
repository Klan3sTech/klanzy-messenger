import type { BootstrapPayload, ChatItem, DeviceSession, Message, UserProfile } from "./types";

/**
 * Пустой base = относительные URL (`/api/...`).
 * В dev они проксируются Vite'ом на http://localhost:3001,
 * в проде — тем же nginx/Caddy, что отдаёт статику.
 * Можно переопределить: VITE_SERVER_URL=https://api.klan.xyz
 */
export const API_BASE: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SERVER_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const post = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  /** ping: если сервер недоступен — приложение уходит в локальный демо-режим */
  async health(): Promise<boolean> {
    const res = await request<{ ok?: boolean }>("/api/bootstrap");
    return Boolean(res && Array.isArray((res as BootstrapPayload).users));
  },

  bootstrap: (username?: string) =>
    request<BootstrapPayload>(`/api/bootstrap${username ? `?username=${encodeURIComponent(username)}` : ""}`),

  register: (profile: UserProfile, clientId: string, deviceName: string) =>
    post<{ ok?: boolean; error?: string; users?: UserProfile[]; session?: DeviceSession & { token?: string } }>("/api/register", {
      profile,
      clientId,
      deviceName,
    }),

  loginRequest: (username: string) =>
    post<{ ok?: boolean; code?: string; error?: string }>("/api/login/code/request", { username }),

  loginVerify: (username: string, code: string, deviceName: string, clientId: string) =>
    post<{ ok?: boolean; users?: UserProfile[]; profile?: UserProfile; session?: DeviceSession; error?: string }>(
      "/api/login/code/verify",
      { username, code, deviceName, clientId },
    ),

  updateProfile: (profile: UserProfile, clientId: string) =>
    post<{ ok?: boolean; users?: UserProfile[]; profile?: UserProfile; error?: string }>("/api/profile/update", {
      profile,
      clientId,
    }),

  sendMessage: (chatId: string, message: Message, clientId: string) =>
    post<{ ok?: boolean }>("/api/messages", { chatId, message, clientId }),

  createChat: (chat: ChatItem, actorUsername: string, clientId: string) =>
    post<{ ok?: boolean; error?: string }>("/api/chats", { chat, actorUsername, clientId }),

  deleteChat: (chatId: string, actorUsername: string, clientId: string) =>
    post<{ ok?: boolean }>("/api/chats/delete", { chatId, actorUsername, clientId }),

  clearChat: (chatId: string, clientId: string) =>
    post<{ ok?: boolean }>(`/api/chats/${encodeURIComponent(chatId)}/clear`, { clientId }),

  sessionsList: (username: string) => post<{ sessions?: DeviceSession[] }>("/api/sessions/list", { username }),

  revokeSession: (username: string, sessionId: string) =>
    post<{ ok?: boolean }>("/api/sessions/revoke", { username, sessionId }),

  adminBan: (username: string, banned: boolean, actorUsername: string) =>
    post<{ ok?: boolean; users?: UserProfile[] }>("/api/admin/ban", { username, banned, actorUsername }),

  adminBadge: (username: string, badge: string, actorUsername: string) =>
    post<{ ok?: boolean; users?: UserProfile[] }>("/api/admin/badge/set", { username, badge, actorUsername }),

  adminDeleteUser: (username: string, actorUsername: string) =>
    post<{ ok?: boolean; users?: UserProfile[] }>("/api/admin/user/delete", { username, actorUsername }),

  adminDeleteChat: (chatId: string, actorUsername: string) =>
    post<{ ok?: boolean; chats?: ChatItem[] }>("/api/admin/chat/delete", { chatId, actorUsername }),

  adminBroadcast: (chatId: string, message: Message, actorUsername: string, clientId: string) =>
    post<{ ok?: boolean }>("/api/admin/message", { chatId, message, actorUsername, clientId }),
};

export function realtimeUrl(clientId: string): string {
  const base = API_BASE || window.location.origin;
  return `${base.replace(/^http/, "ws").replace(/\/$/, "")}/ws?clientId=${encodeURIComponent(clientId)}`;
}
