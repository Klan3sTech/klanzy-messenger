import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, realtimeUrl } from "./api";
import { botReply, demoChats, demoUsers, uid } from "./demo";
import { timeHM } from "./format";
import type {
  AttachmentKind,
  ChatItem,
  ChatKind,
  DeviceSession,
  Message,
  Section,
  ThemeMode,
  UserProfile,
} from "./types";

const STORAGE_KEY = "minx.m3e.v1";
export const CREATOR = "@klan3s";

type Persisted = {
  currentUser: UserProfile | null;
  users: UserProfile[];
  chats: ChatItem[];
  theme: ThemeMode;
  accent: string;
  offline: boolean;
};

type Toast = { id: number; text: string; action?: string };

type Store = {
  ready: boolean;
  currentUser: UserProfile | null;
  users: UserProfile[];
  chats: ChatItem[];
  sections: Section;
  activeChatId: string | null;
  activeChat: ChatItem | null;
  theme: ThemeMode;
  accent: string;
  online: boolean;
  sessions: DeviceSession[];
  search: string;
  toasts: Toast[];
  isCreator: boolean;
  actions: {
    setSection: (section: Section) => void;
    setSearch: (value: string) => void;
    selectChat: (id: string | null) => void;
    setTheme: (theme: ThemeMode) => void;
    setAccent: (accent: string) => void;
    register: (profile: UserProfile) => Promise<boolean>;
    login: (username: string, code: string) => Promise<boolean>;
    loginDemo: (username: string) => Promise<boolean>;
    logout: () => void;
    sendMessage: (chatId: string, text: string, attachment?: { kind: AttachmentKind; name?: string }) => void;
    toggleReaction: (chatId: string, messageId: string, emoji: string) => void;
    createChat: (input: { title: string; username?: string; kind: ChatKind; visibility: "open" | "private" }) => Promise<ChatItem | null>;
    deleteChat: (chatId: string) => void;
    clearChat: (chatId: string) => void;
    updateProfile: (profile: UserProfile) => Promise<boolean>;
    adminBan: (username: string, banned: boolean) => void;
    adminBadge: (username: string, badge: string) => void;
    adminDeleteUser: (username: string) => void;
    refreshSessions: () => Promise<void>;
    revokeSession: (sessionId: string) => Promise<void>;
    toast: (text: string, action?: string) => void;
    dismissToast: (id: number) => void;
  };
};


/** Сервер хранит только строку "HH:MM" — выводим из неё timestamp. */
const normalizeMessage = (message: Message): Message => {
  if (typeof message.ts === "number" && Number.isFinite(message.ts)) return message;
  const [hours, minutes] = String(message.createdAt ?? "00:00").split(":").map(Number);
  const date = new Date();
  if (Number.isFinite(hours) && Number.isFinite(minutes)) date.setHours(hours, minutes, 0, 0);
  return { ...message, ts: date.getTime(), createdAt: message.createdAt || timeHM(date.getTime()) };
};

const normalizeChat = (chat: ChatItem): ChatItem => ({
  ...chat,
  messages: (chat.messages ?? []).map(normalizeMessage),
});

const StoreContext = createContext<Store | null>(null);

const loadPersisted = (): Persisted | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
};

const DEVICE_NAME = (() => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android device";
  if (/iphone|ipad/i.test(ua)) return "iOS device";
  if (/mac/i.test(ua)) return "macOS";
  if (/win/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "Web device";
})();

export function MinxProvider({ children }: { children: ReactNode }) {
  const persisted = useMemo(() => loadPersisted(), []);
  const [ready, setReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(persisted?.currentUser ?? null);
  const [users, setUsers] = useState<UserProfile[]>(persisted?.users ?? demoUsers);
  const [chats, setChats] = useState<ChatItem[]>(persisted?.chats ?? demoChats);
  const [theme, setTheme] = useState<ThemeMode>(persisted?.theme ?? "dark");
  const [accent, setAccent] = useState<string>(persisted?.accent ?? "#6750A4");
  const [sections, setSections] = useState<Section>("chats");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [online, setOnline] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>(uid("client"));

  const toast = useCallback((text: string, action?: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, text, action }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ---------- persistence ---------- */
  useEffect(() => {
    const payload: Persisted = { currentUser, users, chats, theme, accent, offline: !online };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* приватный режим — просто живём без сохранения */
    }
  }, [currentUser, users, chats, theme, accent, online]);

  /* ---------- bootstrap сервера ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await api.health();
      if (!alive) return;
      setOnline(ok);
      if (!ok) {
        setReady(true);
        return;
      }
      const data = await api.bootstrap(currentUser?.username);
      if (!alive || !data) {
        setReady(true);
        return;
      }
      if (Array.isArray(data.users) && data.users.length) setUsers(data.users);
      if (Array.isArray(data.chats) && data.chats.length) {
        const remoteChats = data.chats.map(normalizeChat);
        setChats((prev) => {
          const byId = new Map(remoteChats.map((chat) => [chat.id, chat]));
          const merged = prev.map((chat) => {
            const remote = byId.get(chat.id);
            if (!remote) return chat;
            // Локальная демо-версия богаче серверного сида — оставляем её,
            // но подхватываем серверную, если там реально больше сообщений.
            const remoteCount = remote.messages?.length ?? 0;
            const localCount = chat.messages?.length ?? 0;
            if (remoteCount <= localCount) return chat;
            const known = new Set(chat.messages.map((m) => m.id));
            const extra = (remote.messages || []).filter((m) => !known.has(m.id));
            return { ...chat, ...remote, messages: [...chat.messages, ...extra] };
          });
          const fresh = remoteChats.filter((chat) => !prev.some((item) => item.id === chat.id));
          return [...merged, ...fresh];
        });
      }
      if (Array.isArray(data.sessions)) setSessions(data.sessions);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendMessage = useCallback((chatId: string, message: Message) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        if (chat.messages.some((m) => m.id === message.id)) return chat;
        return { ...chat, messages: [...chat.messages, message] };
      }),
    );
  }, []);

  /* ---------- realtime ---------- */
  useEffect(() => {
    if (!online) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(realtimeUrl(clientIdRef.current));
    } catch {
      return;
    }
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type?: string;
          chat?: ChatItem;
          chatId?: string;
          message?: Message;
          users?: UserProfile[];
          clientId?: string;
        };
        if (data.clientId && data.clientId === clientIdRef.current) return;
        if (data.type === "chat:message" && data.chatId && data.message) {
          appendMessage(data.chatId, {
            ...normalizeMessage(data.message),
            sender: data.message.sender === "me" ? "other" : data.message.sender,
          });
        }
        if (data.type === "chat:create" && data.chat) {
          const incoming = data.chat;
          setChats((prev) => (prev.some((c) => c.id === incoming.id) ? prev : [...prev, incoming]));
        }
        if (data.type === "users:update" && Array.isArray(data.users)) setUsers(data.users);
      } catch {
        /* игнорируем мусорные кадры */
      }
    };
    socketRef.current = socket;
    return () => {
      socket.onmessage = null;
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, appendMessage]);

  const currentRef = useRef(currentUser);
  currentRef.current = currentUser;
  const activeRef = useRef(activeChatId);
  activeRef.current = activeChatId;

  /* ---------- auth ---------- */
  const register = useCallback(
    async (profile: UserProfile) => {
      const prepared: UserProfile = {
        ...profile,
        username: profile.username.startsWith("@") ? profile.username : `@${profile.username}`,
        createdAt: Date.now(),
      };
      const res = await api.register(prepared, clientIdRef.current, DEVICE_NAME);
      const exists = users.some((u) => u.username.toLowerCase() === prepared.username.toLowerCase());
      if (online && (!res || res.error)) {
        if (exists) {
          toast("Этот @username уже занят");
          return false;
        }
        toast("Сервер недоступен — регистрирую локально");
      }
      if (res?.users) setUsers(res.users);
      else setUsers((prev) => (exists ? prev : [...prev, prepared]));
      setCurrentUser(prepared);
      toast(`Добро пожаловать, ${prepared.nickname}!`);
      return true;
    },
    [online, toast, users],
  );

  const login = useCallback(
    async (username: string, code: string) => {
      const handle = username.startsWith("@") ? username : `@${username}`;
      const res = await api.loginVerify(handle, code, DEVICE_NAME, clientIdRef.current);
      if (res?.ok && res.profile) {
        setCurrentUser(res.profile);
        if (res.users) setUsers(res.users);
        toast(`С возвращением, ${res.profile.nickname}!`);
        return true;
      }
      const local = users.find((u) => u.username.toLowerCase() === handle.toLowerCase());
      if (local) {
        setCurrentUser(local);
        toast(`Вход без сервера: ${local.nickname}`);
        return true;
      }
      toast("Не удалось войти: проверь @username и код");
      return false;
    },
    [toast, users],
  );

  const loginDemo = useCallback(
    async (username: string) => {
      const handle = username.startsWith("@") ? username : `@${username}`;
      const existing = users.find((u) => u.username.toLowerCase() === handle.toLowerCase());
      if (existing) {
        setCurrentUser(existing);
        return true;
      }
      const created: UserProfile = {
        nickname: handle.replace("@", ""),
        username: handle,
        email: `${handle.replace("@", "")}@minx.app`,
        createdAt: Date.now(),
      };
      setUsers((prev) => [...prev, created]);
      setCurrentUser(created);
      return true;
    },
    [users],
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    setActiveChatId(null);
    setSections("chats");
  }, []);

  const sendMessage = useCallback(
    (chatId: string, text: string, attachment?: { kind: AttachmentKind; name?: string }) => {
      const body = text.trim();
      if (!body && !attachment) return;
      const me = currentRef.current;
      const ts = Date.now();
      const message: Message = {
        id: uid("msg"),
        sender: "me",
        text: body,
        ts,
        createdAt: timeHM(ts),
        senderUsername: me?.username,
        senderNickname: me?.nickname,
        ...(attachment
          ? { attachment: attachment.kind, attachmentName: attachment.name ?? `${attachment.kind.toLowerCase()}-${ts}` }
          : {}),
      };
      appendMessage(chatId, message);
      if (online) void api.sendMessage(chatId, message, clientIdRef.current);

      const chat = chats.find((c) => c.id === chatId);
      if (chat?.kind === "bot") {
        const botUsername = chat.username || "@MinxSupport";
        window.setTimeout(() => {
          const replyTs = Date.now();
          appendMessage(chatId, {
            id: uid("bot"),
            sender: "other",
            text: botReply(botUsername, body),
            ts: replyTs,
            createdAt: timeHM(replyTs),
            senderUsername: botUsername,
            senderNickname: chat.title,
          });
        }, 700);
      }
    },
    [appendMessage, chats, online],
  );

  const toggleReaction = useCallback(
    (chatId: string, messageId: string, emoji: string) => {
      const me = currentRef.current?.username ?? "@me";
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat;
          return {
            ...chat,
            messages: chat.messages.map((message) => {
              if (message.id !== messageId) return message;
              const reactions = { ...(message.reactions ?? {}) };
              const list = new Set(reactions[emoji] ?? []);
              if (list.has(me)) list.delete(me);
              else list.add(me);
              reactions[emoji] = [...list];
              if (!reactions[emoji].length) delete reactions[emoji];
              return { ...message, reactions };
            }),
          };
        }),
      );
    },
    [],
  );

  const createChat = useCallback(
    async (input: { title: string; username?: string; kind: ChatKind; visibility: "open" | "private" }) => {
      const chat: ChatItem = {
        id: uid("chat"),
        title: input.title.trim(),
        username: input.username?.startsWith("@") ? input.username : input.username ? `@${input.username}` : undefined,
        kind: input.kind,
        visibility: input.visibility,
        subscribed: true,
        ownerUsername: currentRef.current?.username,
        createdAt: Date.now(),
        messages: [],
      };
      if (!chat.title) {
        toast("Введи название");
        return null;
      }
      setChats((prev) => [...prev, chat]);
      setActiveChatId(chat.id);
      if (online) void api.createChat(chat, currentRef.current?.username ?? "", clientIdRef.current);
      toast(`«${chat.title}» создан`);
      return chat;
    },
    [online, toast],
  );

  const deleteChat = useCallback(
    (chatId: string) => {
      setChats((prev) => prev.filter((chat) => chat.id !== chatId));
      setActiveChatId((prev) => (prev === chatId ? null : prev));
      if (online) void api.deleteChat(chatId, currentRef.current?.username ?? "", clientIdRef.current);
      toast("Чат удалён");
    },
    [online, toast],
  );

  const clearChat = useCallback(
    (chatId: string) => {
      setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, messages: [] } : chat)));
      if (online) void api.clearChat(chatId, clientIdRef.current);
      toast("История очищена");
    },
    [online, toast],
  );

  const updateProfile = useCallback(
    async (profile: UserProfile) => {
      const res = await api.updateProfile(profile, clientIdRef.current);
      if (online && res && res.ok === false) {
        toast(res.error || "Не удалось сохранить профиль");
        return false;
      }
      if (res?.users) setUsers(res.users);
      else setUsers((prev) => prev.map((u) => (u.username === profile.username ? { ...u, ...profile } : u)));
      setCurrentUser((prev) => (prev ? { ...prev, ...profile } : profile));
      toast("Профиль обновлён");
      return true;
    },
    [online, toast],
  );

  const adminBan = useCallback(
    (username: string, banned: boolean) => {
      setUsers((prev) => prev.map((u) => (u.username === username ? { ...u, banned } : u)));
      if (online) void api.adminBan(username, banned, currentRef.current?.username ?? "");
      toast(banned ? `${username} заблокирован` : `${username} разблокирован`);
    },
    [online, toast],
  );

  const adminBadge = useCallback(
    (username: string, badge: string) => {
      setUsers((prev) => prev.map((u) => (u.username === username ? { ...u, badge } : u)));
      if (online) void api.adminBadge(username, badge, currentRef.current?.username ?? "");
      toast(`Бейдж «${badge || "нет"}» для ${username}`);
    },
    [online, toast],
  );

  const adminDeleteUser = useCallback(
    (username: string) => {
      setUsers((prev) => prev.filter((u) => u.username !== username));
      if (online) void api.adminDeleteUser(username, currentRef.current?.username ?? "");
      toast(`${username} удалён`);
    },
    [online, toast],
  );

  const refreshSessions = useCallback(async () => {
    const username = currentRef.current?.username;
    if (!username) return;
    const res = await api.sessionsList(username);
    if (res?.sessions) setSessions(res.sessions);
  }, []);

  const revokeSession = useCallback(
    async (sessionId: string) => {
      const username = currentRef.current?.username;
      if (!username) return;
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      await api.revokeSession(username, sessionId);
      toast("Устройство отключено");
    },
    [toast],
  );

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [chats, activeChatId],
  );

  useEffect(() => {
    if (!activeChatId && chats.length) setActiveChatId(chats[0].id);
  }, [activeChatId, chats]);

  const value: Store = {
    ready,
    currentUser,
    users,
    chats,
    sections,
    activeChatId,
    activeChat,
    theme,
    accent,
    online,
    sessions,
    search,
    toasts,
    isCreator: currentUser?.username?.toLowerCase() === CREATOR,
    actions: {
      setSection: setSections,
      setSearch,
      selectChat: setActiveChatId,
      setTheme,
      setAccent,
      register,
      login,
      loginDemo,
      logout,
      sendMessage,
      toggleReaction,
      createChat,
      deleteChat,
      clearChat,
      updateProfile,
      adminBan,
      adminBadge,
      adminDeleteUser,
      refreshSessions,
      revokeSession,
      toast,
      dismissToast,
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <MinxProvider>");
  return ctx;
}
