import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { M3eTheme } from "@m3e/react/theme";
import "@m3e/web/theme";
import "@m3e/web/icon";
import "@m3e/web/icon-button";
import "@m3e/web/switch";

type Theme = "dark" | "light";
type AccentTheme =
  | "blueviolet"
  | "mandarin"
  | "apple"
  | "strawberry"
  | "lemon"
  | "ocean"
  | "orchid"
  | "graphite";
type SectionTab = "chats" | "search" | "events" | "settings";
type SettingsTab = "profile" | "themes" | "admin";
type SearchTab = "Видео" | "Фото" | "Файлы" | "Загрузки" | "Чаты" | "Каналы";
type ChatKind = "direct" | "group" | "channel" | "bot";
type AttachmentType = "Фото" | "Видео" | "Файл" | "Музыка";
type MediaPreviewType = Extract<AttachmentType, "Фото" | "Видео">;

type UserProfile = {
  id?: string;
  nickname: string;
  username: string;
  email?: string;
  avatar?: string;
  badge?: string;
  banned?: boolean;
};

type DeviceSession = {
  id: string;
  deviceName: string;
  lastSeenAt: number;
  createdAt: number;
};

type ChatAdminEntry = {
  chatId: string;
  username: string;
};

type BlockEntry = {
  blockerUsername: string;
  blockedUsername: string;
};

type Message = {
  id: string;
  sender: "me" | "other";
  senderId?: string;
  senderUsername?: string;
  senderNickname?: string;
  text: string;
  createdAt: string;
  attachment?: AttachmentType;
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentMime?: string;
};

type DownloadItem = {
  id: string;
  sourceId: string;
  title: string;
  chatTitle: string;
  url: string;
  progress: number;
  status: "downloading" | "paused" | "done";
};

type GeminiReply = {
  text: string;
  generatedImage?: {
    url: string;
    name: string;
  };
};

type ChatItem = {
  id: string;
  title: string;
  username?: string;
  kind: ChatKind;
  visibility: "open" | "private";
  subscribed?: boolean;
  ownerUsername?: string;
  messages: Message[];
};

type SearchEntity = {
  id: string;
  type: SearchTab;
  label: string;
  username?: string;
  payload: string;
  entityKind: "chat" | "user" | "media";
  userId?: string;
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const base = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized;
  const parsed = Number.parseInt(base, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const searchTabs: SearchTab[] = ["Чаты", "Каналы", "Видео", "Фото", "Файлы", "Загрузки"];
const GEMINI_CHAT_ID = "gemini-support";
const COMMUNITY_CHAT_ID = "klanzy-community";
const CREATOR_USERNAME = "@klan3s";
const USERS_STORAGE_KEY = "klanzy_users";
const CHATS_STORAGE_KEY = "klanzy_chats";
const getServerBaseUrl = () => {
  const envUrl = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_KLANZY_SERVER_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.replace(/\/$/, "");
  }
  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }
  return `${window.location.protocol}//${window.location.hostname}:3001`;
};
const SERVER_URL = getServerBaseUrl();
const WS_URL = SERVER_URL.replace(/^http/i, "ws");
const REGISTERED_SESSION_KEY = "klanzy_registered_session";
const PROFILE_SESSION_KEY = "klanzy_profile_session";
const SESSION_TOKEN_KEY = "klanzy_session_token";
const SESSION_ID_KEY = "klanzy_session_id";
const REALTIME_CHANNEL_KEY = "klanzy_realtime_channel";
const THEME_STORAGE_KEY = "klanzy_theme";
const ACCENT_THEME_STORAGE_KEY = "klanzy_accent_theme";
const DEVICE_NAME =
  typeof navigator !== "undefined" ? `${navigator.platform || "Device"} • ${navigator.userAgent.slice(0, 24)}` : "Unknown device";

const badgeMeta: Record<string, { label: string; icon: string }> = {
  creator: { label: "Создатель", icon: "C" },
  verified: { label: "Проверенный", icon: "V" },
  helper: { label: "Помощник", icon: "H" },
  developer: { label: "Разработчик", icon: "D" },
  vip: { label: "VIP", icon: "VIP" }
};

const normalizeBadge = (badge?: string) => {
  if (!badge) {
    return "";
  }

  const normalized = badge.trim().toLowerCase();
  if (normalized === "создатель") {
    return "creator";
  }

  return normalized;
};
const attachmentOptions: Array<{ kind: AttachmentType; short: string; hint: string }> = [
  { kind: "Фото", short: "IMG", hint: "JPG, PNG, WEBP" },
  { kind: "Видео", short: "VID", hint: "MP4, MOV, WEBM" },
  { kind: "Файл", short: "FILE", hint: "Документы и архивы" },
  { kind: "Музыка", short: "AUD", hint: "MP3, WAV, M4A" }
];

const initialChats: ChatItem[] = [
  {
    id: COMMUNITY_CHAT_ID,
    title: "Общий чат Klanzy",
    username: "@KlanzyCommunity",
    kind: "group",
    visibility: "open",
    ownerUsername: "klan3s",
    messages: [
      {
        id: "m-community-1",
        sender: "other",
        senderUsername: "@KlanzySupport",
        senderNickname: "Klanzy Бот",
        text: "Это общий чат сайта. Здесь можно переписываться с другими людьми, которые сейчас на Klanzy.",
        createdAt: "09:36"
      }
    ]
  },
  {
    id: "support",
    title: "Klanzy Бот",
    username: "@KlanzySupport",
    kind: "bot",
    visibility: "open",
    messages: [
      {
        id: "m1",
        sender: "other",
        senderUsername: "@KlanzySupport",
        senderNickname: "Klanzy Бот",
        text: "Привет. Я KlanzySupport, помогу с навигацией по приложению.",
        createdAt: "09:40"
      }
    ]
  },
  {
    id: "gemini-support",
    title: "Gemini",
    username: "@KlanzyGemini",
    kind: "bot",
    visibility: "open",
    messages: [
      {
        id: "m-gemini-1",
        sender: "other",
        senderUsername: "@KlanzyGemini",
        senderNickname: "Gemini",
        text: "Привет. Я Gemini в Klanzy, можешь писать мне вопросы прямо в этом чате.",
        createdAt: "09:44"
      }
    ]
  },
  {
    id: "channel-klanzy",
    title: "Канал Klanzy",
    username: "@Klanzy",
    kind: "channel",
    visibility: "open",
    ownerUsername: "klan3s",
    subscribed: true,
    messages: [
      {
        id: "m2",
        sender: "other",
        senderUsername: "@Klanzy",
        senderNickname: "Канал Klanzy",
        text: "Добро пожаловать в официальный канал Klanzy. Скоро большой апдейт.",
        createdAt: "10:12"
      }
    ]
  },
  {
    id: "direct-alex",
    title: "Alex",
    username: "@alexdev",
    kind: "direct",
    visibility: "open",
    messages: [
      {
        id: "m3",
        sender: "other",
        senderUsername: "@alexdev",
        senderNickname: "Alex",
        text: "Йо, тестовый чат работает отлично.",
        createdAt: "11:08"
      }
    ]
  }
];

const formatTime = () =>
  new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });

const normalizeUsername = (value: string) => {
  const prepared = value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, "");
  if (!prepared) {
    return "";
  }
  return `@${prepared}`;
};

const createId = () => {
  const nativeCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (nativeCrypto && typeof nativeCrypto.randomUUID === "function") {
    return nativeCrypto.randomUUID();
  }

  if (nativeCrypto && typeof nativeCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    nativeCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `klanzy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const truncateFileName = (fileName: string, maxLength = 34) => {
  if (fileName.length <= maxLength) {
    return fileName;
  }

  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0 || extensionIndex >= fileName.length - 1) {
    return `${fileName.slice(0, maxLength - 1)}...`;
  }

  const extension = fileName.slice(extensionIndex);
  const allowedBaseLength = Math.max(6, maxLength - extension.length - 3);
  return `${fileName.slice(0, allowedBaseLength)}...${extension}`;
};

const getPairCodeFromQuery = () => {
  if (typeof window === "undefined") {
    return "";
  }
  const params = new URLSearchParams(window.location.search);
  return params.get("klanzy_pair") || "";
};

const readImage = async (file: File) => {
  const fileReader = new FileReader();
  const result = await new Promise<string>((resolve, reject) => {
    fileReader.onload = () => resolve(String(fileReader.result));
    fileReader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    fileReader.readAsDataURL(file);
  });

  return result;
};

const createOfflineAiImage = (prompt: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }

  // Lightweight pseudo-generation to give the AI chat a visual response without external APIs.
  const palette = ["#4f46e5", "#7c3aed", "#2563eb", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444"];
  const seed = Array.from(prompt).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorA = palette[seed % palette.length];
  const colorB = palette[(seed + 2) % palette.length];
  const colorC = palette[(seed + 4) % palette.length];

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, colorA);
  gradient.addColorStop(0.5, colorB);
  gradient.addColorStop(1, colorC);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 18; i += 1) {
    context.globalAlpha = 0.16;
    context.fillStyle = palette[(seed + i) % palette.length];
    const size = 80 + ((seed + i * 31) % 280);
    const x = (seed * (i + 11) * 23) % canvas.width;
    const y = (seed * (i + 7) * 17) % canvas.height;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
  context.fillStyle = "rgba(15, 23, 42, 0.28)";
  context.fillRect(32, canvas.height - 190, canvas.width - 64, 150);
  context.fillStyle = "#f8fafc";
  context.font = "600 38px Inter, system-ui, sans-serif";
  context.fillText("Klanzy Gemini", 64, canvas.height - 118);
  context.font = "500 28px Inter, system-ui, sans-serif";
  const caption = prompt.trim().slice(0, 64) || "AI generated image";
  context.fillText(caption, 64, canvas.height - 74);

  return canvas.toDataURL("image/png");
};

const renderAttachment = (
  message: Message,
  onOpenMedia: (payload: { type: MediaPreviewType; url: string; name: string }) => void
) => {
  if (!message.attachment || !message.attachmentUrl) {
    return null;
  }

  if (message.attachment === "Фото") {
    return (
      <button
        type="button"
        onClick={() =>
          onOpenMedia({
            type: "Фото",
            url: message.attachmentUrl ?? "",
            name: message.attachmentName ?? "Фото"
          })
        }
        className="mt-2 block w-full"
      >
        <img
          src={message.attachmentUrl}
          alt={message.attachmentName ?? "Фото"}
          className="max-h-64 w-full rounded-xl object-cover"
        />
      </button>
    );
  }

  if (message.attachment === "Видео") {
    return (
      <div className="mt-2 space-y-1">
        <video src={message.attachmentUrl} controls className="max-h-72 w-full rounded-xl" />
        <button
          type="button"
          onClick={() =>
            onOpenMedia({
              type: "Видео",
              url: message.attachmentUrl ?? "",
              name: message.attachmentName ?? "Видео"
            })
          }
          className="rounded-lg bg-indigo-500/20 px-2 py-1 text-xs"
        >
          Открыть на весь экран
        </button>
      </div>
    );
  }

  if (message.attachment === "Музыка") {
    return <audio src={message.attachmentUrl} controls className="mt-2 w-full" />;
  }

  return (
    <a
      href={message.attachmentUrl}
      download={message.attachmentName}
      title={message.attachmentName}
      className="mt-2 inline-flex max-w-full rounded-lg bg-indigo-500/20 px-2 py-1 text-xs underline-offset-2 hover:underline"
    >
      Скачать файл: {truncateFileName(message.attachmentName ?? "вложение")}
    </a>
  );
};


/* ───────────── M3E: сопоставление акцентов и чтение токенов ───────────── */

const M3_ACCENT_SEEDS: Record<AccentTheme, string> = {
  blueviolet: "#6750A4",
  mandarin: "#B4501B",
  apple: "#2E6B3E",
  strawberry: "#B3261E",
  lemon: "#7A5900",
  ocean: "#00639B",
  orchid: "#8A4585",
  graphite: "#5B5D72"
};

const readStoredTheme = (): Theme =>
  typeof window !== "undefined" && localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";

const readStoredAccent = (): AccentTheme => {
  if (typeof window === "undefined") {
    return "blueviolet";
  }
  const saved = localStorage.getItem(ACCENT_THEME_STORAGE_KEY);
  const known: AccentTheme[] = ["blueviolet", "mandarin", "apple", "strawberry", "lemon", "ocean", "orchid", "graphite"];
  return known.includes(saved as AccentTheme) ? (saved as AccentTheme) : "blueviolet";
};

const toHexColor = (value: string, fallback: string) => {
  const raw = (value || "").trim();
  if (!raw) {
    return fallback;
  }
  if (raw.startsWith("#")) {
    const hex = raw.slice(1);
    if (hex.length === 3) {
      return `#${hex.split("").map((c) => c + c).join("")}`;
    }
    if (hex.length >= 6) {
      return `#${hex.slice(0, 6)}`;
    }
    return fallback;
  }
  const match = raw.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const [r, g, b] = match[1].split(/[\s,/]+/).map((part) => Number.parseFloat(part));
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
      return `#${hex(r)}${hex(g)}${hex(b)}`;
    }
  }
  return fallback;
};

type M3Tokens = {
  primary: string;
  secondary: string;
  onPrimary: string;
  onPrimaryContainer: string;
  primaryContainer: string;
};

const readM3Tokens = (): M3Tokens | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const host = document.querySelector("m3e-theme");
  if (!host) {
    return null;
  }
  const styles = getComputedStyle(host);
  const get = (name: string) => styles.getPropertyValue(name).trim();
  const primary = toHexColor(get("--md-sys-color-primary"), "");
  if (!primary) {
    return null;
  }
  return {
    primary,
    secondary: toHexColor(get("--md-sys-color-tertiary"), primary),
    onPrimary: toHexColor(get("--md-sys-color-on-primary"), "#ffffff"),
    onPrimaryContainer: toHexColor(get("--md-sys-color-on-primary-container"), primary),
    primaryContainer: toHexColor(get("--md-sys-color-primary-container"), primary)
  };
};

function AppShell() {
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [isRegistered, setIsRegistered] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const sessionValue = sessionStorage.getItem(REGISTERED_SESSION_KEY);
    if (sessionValue !== null) {
      return sessionValue === "1";
    }
    return localStorage.getItem("klanzy_registered") === "1";
  });
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  });
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => {
    if (typeof window === "undefined") {
      return "blueviolet";
    }
    const savedAccent = localStorage.getItem(ACCENT_THEME_STORAGE_KEY);
    if (
      savedAccent === "mandarin" ||
      savedAccent === "apple" ||
      savedAccent === "strawberry" ||
      savedAccent === "lemon" ||
      savedAccent === "ocean" ||
      savedAccent === "orchid" ||
      savedAccent === "graphite"
    ) {
      return savedAccent;
    }
    return "blueviolet";
  });
  const [liteMode, setLiteMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return localStorage.getItem("klanzy_lite_mode") === "1";
  });
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (typeof window === "undefined") {
      return { nickname: "", username: "", email: "" };
    }

    try {
      const rawProfile = sessionStorage.getItem(PROFILE_SESSION_KEY) ?? localStorage.getItem("klanzy_profile");
      if (!rawProfile) {
        return { nickname: "", username: "", email: "" };
      }
      const parsed = JSON.parse(rawProfile) as UserProfile;
      return {
        nickname: parsed.nickname ?? "",
        username: parsed.username ?? "",
        email: parsed.email ?? "",
        badge: parsed.badge,
        banned: parsed.banned,
        avatar: parsed.avatar
      };
    } catch {
      return { nickname: "", username: "", email: "" };
    }
  });
  const [users, setUsers] = useState<UserProfile[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
      const parsedUsers = rawUsers ? (JSON.parse(rawUsers) as UserProfile[]) : [];
      return parsedUsers.filter((user) => user.username);
    } catch {
      return [];
    }
  });
  const [usernameError, setUsernameError] = useState("");
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaveStatus, setProfileSaveStatus] = useState("");
  const [codeLoginUsername, setCodeLoginUsername] = useState("");
  const [codeLoginValue, setCodeLoginValue] = useState("");
  const [codeLoginStatus, setCodeLoginStatus] = useState("");
  const [sessionLoginCode, setSessionLoginCode] = useState("");
  const [sessionLoginQr, setSessionLoginQr] = useState("");
  const [sessionLoginCodeStatus, setSessionLoginCodeStatus] = useState("");
  const [qrLoginStatus, setQrLoginStatus] = useState("");
  const [qrPairCode, setQrPairCode] = useState("");
  const [qrPairImage, setQrPairImage] = useState("");
  const [qrPairPollStatus, setQrPairPollStatus] = useState("");
  const [pendingPairCode, setPendingPairCode] = useState("");
  const [blockEntries, setBlockEntries] = useState<BlockEntry[]>([]);
  const [adminActionStatus, setAdminActionStatus] = useState("");
  const [adminMessageChatId, setAdminMessageChatId] = useState("");
  const [adminMessageText, setAdminMessageText] = useState("");
  const [adminBadgeUser, setAdminBadgeUser] = useState("");
  const [adminBadgeValue, setAdminBadgeValue] = useState("verified");
  const [chatAdminTargetUsername, setChatAdminTargetUsername] = useState("");
  const [chatManageStatus, setChatManageStatus] = useState("");
  const [chats, setChats] = useState<ChatItem[]>(() => {
    if (typeof window === "undefined") {
      return initialChats;
    }
    try {
      const rawChats = localStorage.getItem(CHATS_STORAGE_KEY);
      if (!rawChats) {
        return initialChats;
      }
      const parsedChats = JSON.parse(rawChats) as ChatItem[];
      return parsedChats.length > 0 ? parsedChats : initialChats;
    } catch {
      return initialChats;
    }
  });
  const [activeChatId, setActiveChatId] = useState(initialChats[0].id);
  const [activeSection, setActiveSection] = useState<SectionTab>("chats");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("profile");
  const [activeSearchTab, setActiveSearchTab] = useState<SearchTab>("Чаты");
  const [globalSearch, setGlobalSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [blockedChatIds, setBlockedChatIds] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createType, setCreateType] = useState<"group" | "channel">("group");
  const [createVisibility, setCreateVisibility] = useState<"open" | "private">("open");
  const [createTitle, setCreateTitle] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [pendingAttachmentType, setPendingAttachmentType] = useState<AttachmentType>("Файл");
  const [mediaViewer, setMediaViewer] = useState<{
    type: MediaPreviewType;
    url: string;
    name: string;
  } | null>(null);
  const [messageActionMenu, setMessageActionMenu] = useState<{
    chatId: string;
    messageId: string;
    x: number;
    y: number;
  } | null>(null);
  const [aiApiKey, setAiApiKey] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return localStorage.getItem("klanzy_gemini_api_key") ?? "";
  });
  const [aiModel, setAiModel] = useState(() => {
    if (typeof window === "undefined") {
      return "gemini-2.5-flash";
    }
    return localStorage.getItem("klanzy_gemini_model") ?? "gemini-2.5-flash";
  });
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [chatAdmins, setChatAdmins] = useState<ChatAdminEntry[]>([]);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [sessionToken, setSessionToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return localStorage.getItem(SESSION_TOKEN_KEY) || "";
  });
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return localStorage.getItem(SESSION_ID_KEY) || "";
  });
  const [deviceActionStatus, setDeviceActionStatus] = useState("");
  const [codeEmailStatus, setCodeEmailStatus] = useState("");
  const [directoryUsers, setDirectoryUsers] = useState<UserProfile[]>([]);
  const [messageReplyTarget, setMessageReplyTarget] = useState<{ id: string; text: string } | null>(null);
  const [pinnedByChat, setPinnedByChat] = useState<Record<string, string>>({});
  const [adminSessionUser, setAdminSessionUser] = useState("");
  const [showChatMenu, setShowChatMenu] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const registerAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const serverSocketRef = useRef<WebSocket | null>(null);
  const realtimeChannelRef = useRef<BroadcastChannel | null>(null);
  const realtimeClientIdRef = useRef(`klanzy-${createId()}`);
  const skipChatsRealtimeRef = useRef(false);
  const skipUsersRealtimeRef = useRef(false);
  const lastSavedChatsRef = useRef("");
  const lastSavedUsersRef = useRef("");

  const currentUsername = normalizeUsername(profile.username.replace("@", ""));

  const isOwnerOfChat = (chat: ChatItem) =>
    Boolean(chat.ownerUsername) &&
    normalizeUsername((chat.ownerUsername || "").replace("@", "")) === currentUsername;

  /* Группы и каналы видит только тот, кто их создал. */
  const visibleChatList = chats.filter((chat) => {
    if (chat.kind === "group" || chat.kind === "channel") {
      return isOwnerOfChat(chat);
    }
    return true;
  });

  const EMPTY_CHAT: ChatItem = {
    id: "no-chats",
    title: "Нет доступных чатов",
    username: "",
    kind: "direct",
    visibility: "open",
    messages: []
  };

  const activeChat =
    visibleChatList.find((chat) => chat.id === activeChatId) ?? visibleChatList[0] ?? EMPTY_CHAT;
  const currentUser = useMemo(
    () =>
      users.find(
        (user) =>
          (profile.id && user.id === profile.id) ||
          normalizeUsername((user.username || "").replace("@", "")) === currentUsername
      ),
    [users, profile.id, currentUsername]
  );
  const isAdmin = currentUsername === CREATOR_USERNAME;
  const activeChatUsername = normalizeUsername((activeChat.username || "").replace("@", ""));
  const getBadgeInfo = (badge?: string) => {
    const normalized = normalizeBadge(badge);
    if (!normalized) {
      return undefined;
    }

    const meta = badgeMeta[normalized];
    if (meta) {
      return meta;
    }

    const fallbackLabel = badge?.trim() || "Badge";
    return {
      label: fallbackLabel,
      icon: fallbackLabel.slice(0, 2).toUpperCase()
    };
  };

  /* Управление админами группы/канала — только у создателя. */
  const canManageActiveChat =
    (activeChat.kind === "group" || activeChat.kind === "channel") && isOwnerOfChat(activeChat);

  const activeChatAdmins = chatAdmins
    .filter((entry) => entry.chatId === activeChat.id)
    .map((entry) => normalizeUsername((entry.username || "").replace("@", "")));

  const managedChatUsers = users.filter((user) => {
    const normalized = normalizeUsername((user.username || "").replace("@", ""));
    if (!normalized) {
      return false;
    }
    if (normalized === currentUsername) {
      return false;
    }
    if (normalized === normalizeUsername((activeChat.ownerUsername || "").replace("@", ""))) {
      return false;
    }
    return true;
  });

  const isMessageMine = (message: Message) => {
    if (message.senderUsername) {
      return normalizeUsername(message.senderUsername.replace("@", "")) === currentUsername;
    }
    return message.sender === "me";
  };
  const getBadgeForUsername = (username?: string) => {
    const normalized = normalizeUsername((username || "").replace("@", ""));
    if (!normalized) {
      return undefined;
    }
    return users.find((user) => normalizeUsername((user.username || "").replace("@", "")) === normalized)?.badge;
  };

  const renderBadge = (badge?: string, size: "sm" | "xs" = "sm") => {
    const badgeInfo = getBadgeInfo(badge);
    if (!badgeInfo) {
      return null;
    }

    return (
      <span
        title={badgeInfo.label}
        aria-label={badgeInfo.label}
        className={`inline-flex items-center justify-center rounded-full border font-semibold ${
          size === "sm" ? "h-6 min-w-6 px-2 text-[10px]" : "h-4 min-w-4 px-1 text-[8px]"
        }`}
        style={accentChipStyle}
      >
        {badgeInfo.icon}
      </span>
    );
  };
  const isBlockedByMeServer =
    Boolean(activeChatUsername) &&
    blockEntries.some((entry) => entry.blockerUsername === currentUsername && entry.blockedUsername === activeChatUsername);
  const isBlockedByOther =
    Boolean(activeChatUsername) &&
    blockEntries.some((entry) => entry.blockerUsername === activeChatUsername && entry.blockedUsername === currentUsername);
  const isBlocked = blockedChatIds.includes(activeChat.id) || isBlockedByMeServer;
  const isChannel = activeChat.kind === "channel";
  const isSubscribed = activeChat.subscribed ?? true;

  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) {
      return activeChat.messages;
    }
    const lowered = messageSearch.toLowerCase();
    return activeChat.messages.filter((message) => message.text.toLowerCase().includes(lowered));
  }, [activeChat.messages, messageSearch]);

  const pinnedMessage = useMemo(
    () => activeChat.messages.find((message) => message.id === pinnedByChat[activeChat.id]),
    [activeChat, pinnedByChat]
  );

  useEffect(() => {
    if (activeSection !== "search") {
      return;
    }

    const query = globalSearch.trim();
    if (query.length < 2) {
      setDirectoryUsers([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/users?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { users?: UserProfile[] };
        if (Array.isArray(payload.users)) {
          setDirectoryUsers(payload.users);
        }
      } catch {
        // Keep local search fallback when server is unavailable.
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeSection, globalSearch]);

  const searchableEntities = useMemo<SearchEntity[]>(() => {
    const canShowSearchChat = (chat: ChatItem) => {
      if (chat.kind === "direct" || chat.kind === "bot") {
        return true;
      }

      if (chat.kind === "channel" || chat.kind === "group") {
        return isOwnerOfChat(chat);
      }

      return true;
    };

    const visibleChats = chats.filter(canShowSearchChat);

    const all: SearchEntity[] = visibleChats.map((chat) => {
      const base = `${chat.title} ${chat.username ?? ""}`.toLowerCase();
      const type: SearchTab = chat.kind === "channel" ? "Каналы" : "Чаты";
      return {
        id: chat.id,
        type,
        label: chat.title,
        username: chat.username,
        payload: base,
        entityKind: "chat"
      };
    });

    const mergedUsers = [...users, ...directoryUsers].filter(
      (user, index, list) =>
        list.findIndex(
          (candidate) => normalizeUsername((candidate.username || "").replace("@", "")) === normalizeUsername((user.username || "").replace("@", ""))
        ) === index
    );

    const people: SearchEntity[] = mergedUsers
      .filter((user) => user.username)
      .map((user) => ({
        id: `user-${user.id ?? user.username}`,
        type: "Чаты",
        label: user.nickname || user.username,
        username: user.username,
        payload: `${user.nickname} ${user.username}`.toLowerCase(),
        entityKind: "user",
        userId: user.id
      }));

    const media: SearchEntity[] = visibleChats.flatMap((chat) =>
      chat.messages
        .filter((message) => message.attachment)
        .map((message) => ({
          id: `${chat.id}-${message.id}`,
          type:
            message.attachment === "Видео"
              ? "Видео"
              : message.attachment === "Фото"
                ? "Фото"
                : message.attachment === "Файл"
                  ? "Файлы"
                  : "Загрузки",
          label: `${message.attachment}: ${chat.title}`,
          username: chat.username,
          payload: `${message.text} ${message.attachmentName ?? ""} ${chat.title}`.toLowerCase(),
          entityKind: "media"
        }))
    );

    return [...all, ...people, ...media];
  }, [chats, users, directoryUsers, currentUsername]);

  const searchResults = useMemo(() => {
    const normalized = globalSearch.trim().toLowerCase();
    return searchableEntities.filter((entity) => {
      const tabMatch = activeSearchTab === entity.type;
      const queryMatch = !normalized || entity.payload.includes(normalized);
      return tabMatch && queryMatch;
    });
  }, [activeSearchTab, globalSearch, searchableEntities]);

  const showPoppyHands = globalSearch.trim().toLowerCase().includes("poppy playtime");

  const downloadSources = useMemo(
    () =>
      chats.flatMap((chat) =>
        chat.messages
          .filter(
            (message) =>
              message.attachment &&
              message.attachmentUrl &&
              (message.attachment === "Файл" || message.attachment === "Музыка")
          )
          .map((message) => ({
            sourceId: `${chat.id}-${message.id}`,
            title: message.attachmentName || `${message.attachment}: ${chat.title}`,
            chatTitle: chat.title,
            url: message.attachmentUrl as string,
            payload: `${message.attachmentName ?? ""} ${message.text} ${chat.title}`.toLowerCase()
          }))
      ),
    [chats]
  );

  const filteredDownloadSources = useMemo(() => {
    const normalized = globalSearch.trim().toLowerCase();
    return downloadSources.filter((item) => !normalized || item.payload.includes(normalized));
  }, [downloadSources, globalSearch]);

  const accentThemes: Record<AccentTheme, { primary: string; secondary: string; soft: string; text: string }> = {
    blueviolet: {
      primary: "#6366f1",
      secondary: "#8b5cf6",
      soft: "rgba(99, 102, 241, 0.2)",
      text: "#e0e7ff"
    },
    mandarin: {
      primary: "#f97316",
      secondary: "#fb923c",
      soft: "rgba(249, 115, 22, 0.24)",
      text: "#ffedd5"
    },
    apple: {
      primary: "#22c55e",
      secondary: "#16a34a",
      soft: "rgba(34, 197, 94, 0.24)",
      text: "#dcfce7"
    },
    strawberry: {
      primary: "#ef4444",
      secondary: "#f43f5e",
      soft: "rgba(239, 68, 68, 0.24)",
      text: "#fee2e2"
    },
    lemon: {
      primary: "#eab308",
      secondary: "#facc15",
      soft: "rgba(234, 179, 8, 0.28)",
      text: "#fef9c3"
    },
    ocean: {
      primary: "#0ea5e9",
      secondary: "#06b6d4",
      soft: "rgba(14, 165, 233, 0.22)",
      text: "#e0f2fe"
    },
    orchid: {
      primary: "#a855f7",
      secondary: "#d946ef",
      soft: "rgba(168, 85, 247, 0.22)",
      text: "#f3e8ff"
    },
    graphite: {
      primary: "#64748b",
      secondary: "#475569",
      soft: "rgba(100, 116, 139, 0.22)",
      text: "#e2e8f0"
    }
  };

  const baseAccent = accentThemes[accentTheme];
  const [m3Tokens, setM3Tokens] = useState<M3Tokens | null>(null);

  useEffect(() => {
    let frame = 0;
    let timer = 0;
    const sync = () => {
      const tokens = readM3Tokens();
      if (tokens) {
        setM3Tokens(tokens);
      }
    };
    frame = window.requestAnimationFrame(sync);
    timer = window.setTimeout(sync, 150);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [theme, accentTheme]);

  const accent = {
    primary: m3Tokens?.primary ?? baseAccent.primary,
    secondary: m3Tokens?.secondary ?? baseAccent.secondary,
    soft: hexToRgba(m3Tokens?.primary ?? baseAccent.primary, theme === "dark" ? 0.22 : 0.14),
    text: m3Tokens?.onPrimaryContainer ?? baseAccent.text
  };

  const surface = "var(--md-sys-color-surface)";
  const surfaceLow = "var(--md-sys-color-surface-container-low)";
  const surfaceMid = "var(--md-sys-color-surface-container)";
  const surfaceHigh = "var(--md-sys-color-surface-container-high)";
  const surfaceHighest = "var(--md-sys-color-surface-container-highest)";
  const outline = "var(--md-sys-color-outline-variant)";

  const pageBackgroundStyle: CSSProperties = {
    backgroundImage: liteMode
      ? `linear-gradient(160deg, ${surface}, ${hexToRgba(accent.primary, theme === "dark" ? 0.14 : 0.08)})`
      : `radial-gradient(70% 50% at 12% 0%, ${hexToRgba(accent.primary, theme === "dark" ? 0.26 : 0.18)}, transparent 70%), radial-gradient(55% 45% at 96% 100%, ${hexToRgba(accent.secondary, theme === "dark" ? 0.2 : 0.14)}, transparent 72%), ${surface}`
  };

  const panelStyle: CSSProperties = {
    backgroundColor: surfaceMid,
    borderColor: outline,
    borderRadius: "1.75rem"
  };

  const accentSurfaceStyle: CSSProperties = {
    backgroundColor: hexToRgba(accent.primary, theme === "dark" ? 0.14 : 0.1)
  };

  const accentButtonStyle: CSSProperties = {
    backgroundColor: "var(--md-sys-color-primary)",
    color: "var(--md-sys-color-on-primary)",
    borderRadius: "999px",
    boxShadow: "0 1px 3px rgba(0,0,0,.28)"
  };

  const accentChipStyle: CSSProperties = {
    backgroundColor: "var(--md-sys-color-secondary-container)",
    color: "var(--md-sys-color-on-secondary-container)",
    borderColor: "transparent",
    borderRadius: "999px"
  };

  const accentInputStyle: CSSProperties = {
    borderColor: outline,
    backgroundColor: surfaceHigh,
    borderRadius: "1rem"
  };

  const accentSoftStyle: CSSProperties = {
    backgroundColor: surfaceLow,
    borderColor: outline,
    borderRadius: "1.25rem"
  };

  const messageActionMenuStyle: CSSProperties = {
    backgroundColor: surfaceHighest,
    borderColor: outline,
    borderRadius: "1.25rem"
  };

  const accentBubbleStyle: CSSProperties = {
    backgroundColor: surfaceHigh,
    borderColor: outline
  };

  const accentMineMessageStyle: CSSProperties = {
    backgroundColor: "var(--md-sys-color-primary)",
    color: "var(--md-sys-color-on-primary)"
  };

  const containerClass = "text-[color:var(--md-sys-color-on-surface)]";

  const panelClass = liteMode ? "border" : "border backdrop-blur-xl";

  const accentChipClass = "border";

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("klanzy:skin", { detail: { theme, accentTheme } }));
    document.documentElement.style.colorScheme = theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.backgroundColor = theme === "dark" ? "#020617" : "#ffffff";
    document.body.style.backgroundColor = theme === "dark" ? "#020617" : "#ffffff";
    document.body.style.color = theme === "dark" ? "#e2e8f0" : "#0f172a";
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(ACCENT_THEME_STORAGE_KEY, accentTheme);
  }, [accentTheme]);

  useEffect(() => {
    localStorage.setItem("klanzy_lite_mode", liteMode ? "1" : "0");
    document.documentElement.dataset.lite = liteMode ? "true" : "false";
  }, [liteMode]);

  useEffect(() => {
    localStorage.setItem("klanzy_gemini_api_key", aiApiKey);
  }, [aiApiKey]);

  useEffect(() => {
    localStorage.setItem("klanzy_registered", isRegistered ? "1" : "0");
    sessionStorage.setItem(REGISTERED_SESSION_KEY, isRegistered ? "1" : "0");
  }, [isRegistered]);

  useEffect(() => {
    localStorage.setItem("klanzy_profile", JSON.stringify(profile));
    sessionStorage.setItem(PROFILE_SESSION_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (sessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    } else {
      localStorage.removeItem(SESSION_ID_KEY);
    }
  }, [sessionId]);

  useEffect(() => {
    localStorage.setItem("klanzy_gemini_model", aiModel);
  }, [aiModel]);

  useEffect(() => {
    const serializedChats = JSON.stringify(chats);
    if (serializedChats === lastSavedChatsRef.current) {
      return;
    }

    lastSavedChatsRef.current = serializedChats;
    localStorage.setItem(CHATS_STORAGE_KEY, serializedChats);

    if (skipChatsRealtimeRef.current) {
      skipChatsRealtimeRef.current = false;
      return;
    }

    realtimeChannelRef.current?.postMessage({
      type: "chats:update",
      senderId: realtimeClientIdRef.current,
      chats
    });
  }, [chats]);

  useEffect(() => {
    const serializedUsers = JSON.stringify(users);
    if (serializedUsers === lastSavedUsersRef.current) {
      return;
    }

    lastSavedUsersRef.current = serializedUsers;
    localStorage.setItem(USERS_STORAGE_KEY, serializedUsers);

    if (skipUsersRealtimeRef.current) {
      skipUsersRealtimeRef.current = false;
      return;
    }

    realtimeChannelRef.current?.postMessage({
      type: "users:update",
      senderId: realtimeClientIdRef.current,
      users
    });
  }, [users]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(REALTIME_CHANNEL_KEY);
    realtimeChannelRef.current = channel;

    channel.onmessage = (event: MessageEvent<{ type?: string; senderId?: string; chats?: ChatItem[]; users?: UserProfile[] }>) => {
      const payload = event.data;
      if (!payload || payload.senderId === realtimeClientIdRef.current) {
        return;
      }

      if (payload.type === "chats:update" && Array.isArray(payload.chats) && payload.chats.length > 0) {
        skipChatsRealtimeRef.current = true;
        setChats(payload.chats);
      }

      if (payload.type === "users:update" && Array.isArray(payload.users)) {
        skipUsersRealtimeRef.current = true;
        setUsers(payload.users);
      }
    };

    return () => {
      channel.close();
      realtimeChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CHATS_STORAGE_KEY && event.newValue) {
        try {
          const nextChats = JSON.parse(event.newValue) as ChatItem[];
          if (Array.isArray(nextChats) && nextChats.length > 0) {
            skipChatsRealtimeRef.current = true;
            setChats(nextChats);
          }
        } catch {
          // Ignore malformed external updates.
        }
      }

      if (event.key === USERS_STORAGE_KEY && event.newValue) {
        try {
          const nextUsers = JSON.parse(event.newValue) as UserProfile[];
          if (Array.isArray(nextUsers)) {
            skipUsersRealtimeRef.current = true;
            setUsers(nextUsers);
          }
        } catch {
          // Ignore malformed external updates.
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchBootstrap = async () => {
      try {
        const bootstrapUrl = currentUsername
          ? `${SERVER_URL}/api/bootstrap?username=${encodeURIComponent(currentUsername)}`
          : `${SERVER_URL}/api/bootstrap`;
        const response = await fetch(bootstrapUrl);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          chats?: ChatItem[];
          users?: UserProfile[];
          blocks?: BlockEntry[];
          chatAdmins?: ChatAdminEntry[];
          sessions?: DeviceSession[];
        };
        if (!isMounted) {
          return;
        }

        if (Array.isArray(payload.users)) {
          skipUsersRealtimeRef.current = true;
          setUsers(payload.users);
        }

        if (Array.isArray(payload.chats) && payload.chats.length > 0) {
          skipChatsRealtimeRef.current = true;
          setChats(payload.chats);
        }

        if (Array.isArray(payload.blocks)) {
          setBlockEntries(payload.blocks);
        }

        if (Array.isArray(payload.chatAdmins)) {
          setChatAdmins(payload.chatAdmins);
        }

        if (Array.isArray(payload.sessions)) {
          setDeviceSessions(payload.sessions);
        }
      } catch {
        // Server may be unavailable, keep local mode.
      }
    };

    fetchBootstrap();

    try {
      const socket = new WebSocket(`${WS_URL}/ws?clientId=${encodeURIComponent(realtimeClientIdRef.current)}`);
      serverSocketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type?: string;
            clientId?: string;
            chatId?: string;
            message?: Message;
            chat?: ChatItem;
            users?: UserProfile[];
            blocks?: BlockEntry[];
            chatAdmins?: ChatAdminEntry[];
            sessions?: DeviceSession[];
            username?: string;
          };

          if (!payload || payload.clientId === realtimeClientIdRef.current) {
            return;
          }

          if (payload.type === "users:update" && Array.isArray(payload.users)) {
            skipUsersRealtimeRef.current = true;
            setUsers(payload.users);
          }

          if (payload.type === "blocks:update" && Array.isArray(payload.blocks)) {
            setBlockEntries(payload.blocks);
          }

          if (payload.type === "chat-admins:update" && Array.isArray(payload.chatAdmins)) {
            setChatAdmins(payload.chatAdmins);
          }

          if (
            payload.type === "sessions:update" &&
            Array.isArray(payload.sessions) &&
            payload.username &&
            normalizeUsername(payload.username.replace("@", "")) === currentUsername
          ) {
            setDeviceSessions(payload.sessions);
          }

          if (payload.type === "chat:create" && payload.chat) {
            skipChatsRealtimeRef.current = true;
            setChats((prev) => (prev.some((chat) => chat.id === payload.chat?.id) ? prev : [payload.chat as ChatItem, ...prev]));
          }

          if (payload.type === "chat:clear" && payload.chatId) {
            skipChatsRealtimeRef.current = true;
            setChats((prev) => prev.map((chat) => (chat.id === payload.chatId ? { ...chat, messages: [] } : chat)));
          }

          if (payload.type === "chat:message" && payload.chatId && payload.message) {
            skipChatsRealtimeRef.current = true;
            setChats((prev) =>
              prev.map((chat) => {
                if (chat.id !== payload.chatId) {
                  return chat;
                }
                if (chat.messages.some((message) => message.id === payload.message?.id)) {
                  return chat;
                }
                return {
                  ...chat,
                  messages: [...chat.messages, payload.message as Message]
                };
              })
            );
          }

          if (payload.type === "chat:message-delete" && payload.chatId && payload.message?.id) {
            skipChatsRealtimeRef.current = true;
            setChats((prev) =>
              prev.map((chat) =>
                chat.id === payload.chatId
                  ? {
                      ...chat,
                      messages: chat.messages.filter((message) => message.id !== payload.message?.id)
                    }
                  : chat
              )
            );
          }

          if (payload.type === "chat:delete" && payload.chatId) {
            skipChatsRealtimeRef.current = true;
            setChats((prev) => prev.filter((chat) => chat.id !== payload.chatId));
          }
        } catch {
          // Ignore malformed server events.
        }
      };
    } catch {
      // Ignore websocket init errors and stay in local mode.
    }

    return () => {
      isMounted = false;
      serverSocketRef.current?.close();
      serverSocketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isRegistered || !currentUsername) {
      return;
    }

    const exists = users.some(
      (user) => normalizeUsername((user.username || "").replace("@", "")) === currentUsername
    );

    if (!exists) {
      setUsers((prev) => [
        ...prev,
        {
          id: profile.id,
          nickname: profile.nickname,
          username: currentUsername,
          email: profile.email,
          badge: profile.badge,
          banned: false,
          avatar: profile.avatar
        }
      ]);
    }
  }, [isRegistered, currentUsername, users, profile.id, profile.nickname, profile.email, profile.badge, profile.avatar]);

  useEffect(() => {
    if (isRegistered && !profile.id) {
      setProfile((prev) => ({ ...prev, id: createId() }));
    }
  }, [isRegistered, profile.id]);

  useEffect(() => {
    if (isRegistered && currentUser?.banned) {
      window.alert("Ваш аккаунт заблокирован администратором.");
      setIsRegistered(false);
      setSessionToken("");
      setSessionId("");
    }
  }, [isRegistered, currentUser?.banned]);

  useEffect(() => {
    if (isRegistered && profile.id && users.length > 0 && !currentUser) {
      window.alert("Ваш аккаунт был удален администратором.");
      setIsRegistered(false);
      setSessionToken("");
      setSessionId("");
    }
  }, [isRegistered, profile.id, users, currentUser]);

  useEffect(() => {
    if (!isRegistered || !currentUser) {
      return;
    }
    setProfile((prev) => ({
      ...prev,
      badge: currentUser.badge,
      email: currentUser.email || prev.email,
      nickname: currentUser.nickname || prev.nickname,
      username: currentUser.username || prev.username,
      avatar: currentUser.avatar || prev.avatar,
      banned: currentUser.banned
    }));
  }, [isRegistered, currentUser]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDownloads((prev) =>
        prev.map((item) => {
          if (item.status !== "downloading") {
            return item;
          }

          const nextProgress = Math.min(100, item.progress + 10);
          return {
            ...item,
            progress: nextProgress,
            status: nextProgress >= 100 ? "done" : "downloading"
          };
        })
      );
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setChats((prev) => {
      const missing = initialChats.filter((baseChat) => !prev.some((chat) => chat.id === baseChat.id));
      if (missing.length === 0) {
        return prev;
      }
      return [...prev, ...missing];
    });
  }, []);

  useEffect(() => {
    if (!chats.some((chat) => chat.id === activeChatId) && chats[0]) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  useEffect(() => {
    if (!isAdmin && activeSettingsTab === "admin") {
      setActiveSettingsTab("profile");
    }
  }, [isAdmin, activeSettingsTab]);

  const postToServer = async (path: string, payload: unknown) => {
    try {
      const response = await fetch(`${SERVER_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      return response;
    } catch {
      return null;
    }
  };

  const isUsernameTakenByOthers = (candidate: string, excludeUserId?: string) => {
    const normalized = normalizeUsername(candidate.replace("@", ""));
    if (!normalized) {
      return false;
    }

    const usedByUser = users.some((user) => {
      const sameUser = Boolean(excludeUserId) && user.id === excludeUserId;
      if (sameUser) {
        return false;
      }
      return normalizeUsername((user.username || "").replace("@", "")) === normalized;
    });

    const usedByChat = chats.some(
      (chat) => chat.username && normalizeUsername(chat.username.replace("@", "")) === normalized
    );

    return usedByUser || usedByChat;
  };

  const updateProfileSettings = async () => {
    const preparedNickname = profile.nickname.trim();
    const preparedUsername = normalizeUsername(profile.username.replace("@", ""));
    const preparedEmail = (profile.email || "").trim().toLowerCase();

    if (!preparedNickname || !preparedUsername || !preparedEmail) {
      setProfileSaveStatus("");
      setProfileSaveError("Заполни ник, username и почту.");
      return;
    }

    const emailTaken = users.some(
      (user) => user.id !== profile.id && (user.email || "").trim().toLowerCase() === preparedEmail
    );

    if (isUsernameTakenByOthers(preparedUsername, profile.id) || emailTaken) {
      setProfileSaveStatus("");
      setProfileSaveError("Этот username или email уже заняты.");
      return;
    }

    const response = await postToServer("/api/profile/update", {
      profile: {
        ...profile,
        nickname: preparedNickname,
        username: preparedUsername,
        email: preparedEmail
      },
      clientId: realtimeClientIdRef.current
    });

    if (response?.status === 409) {
      setProfileSaveStatus("");
      setProfileSaveError("Этот username или email уже заняты.");
      return;
    }

    if (!response?.ok) {
      setProfileSaveStatus("");
      setProfileSaveError("Не удалось сохранить профиль.");
      return;
    }

    try {
      const payload = (await response.json()) as { users?: UserProfile[]; profile?: UserProfile };
      if (Array.isArray(payload.users)) {
        skipUsersRealtimeRef.current = true;
        setUsers(payload.users);
      }
      if (payload.profile) {
        setProfile((prev) => ({ ...prev, ...payload.profile }));
      }
    } catch {
      // Keep local profile as-is if response body is empty.
    }

    setProfileSaveError("");
    setProfileSaveStatus("Профиль сохранен");
  };

  const buildLoginQrCode = async (username: string, code: string) => {
    if (typeof window === "undefined") {
      return "";
    }
    const loginUrl = new URL(window.location.href);
    loginUrl.searchParams.set("klanzy_user", username);
    loginUrl.searchParams.set("klanzy_code", code);
    const qrDataUrl = await QRCode.toDataURL(loginUrl.toString(), {
      width: 260,
      margin: 1,
      color: {
        dark: "#111827",
        light: "#ffffff"
      }
    });
    return qrDataUrl;
  };

  const completeCodeLogin = (payload: {
    profile?: UserProfile;
    session?: { token?: string; id?: string };
    sessions?: DeviceSession[];
  }) => {
    if (!payload.profile) {
      return false;
    }

    setProfile({
      id: payload.profile.id,
      nickname: payload.profile.nickname,
      username: payload.profile.username,
      email: payload.profile.email || "",
      avatar: payload.profile.avatar,
      badge: payload.profile.badge,
      banned: payload.profile.banned
    });
    setSessionToken(payload.session?.token || "");
    setSessionId(payload.session?.id || "");
    if (Array.isArray(payload.sessions)) {
      setDeviceSessions(payload.sessions);
    }
    setIsRegistered(true);
    return true;
  };

  const requestSessionLoginCode = async () => {
    if (!currentUsername) {
      return;
    }
    const response = await postToServer("/api/login/code/request", {
      username: currentUsername,
      revealCode: true
    });
    if (!response?.ok) {
      setSessionLoginCode("");
      setSessionLoginQr("");
      setCodeEmailStatus("");
      setSessionLoginCodeStatus("Не удалось создать код входа.");
      return;
    }
    const payload = (await response.json()) as {
      code?: string;
      sentToEmail?: boolean;
      maskedEmail?: string;
    };
    const freshCode = payload.code || "";
    setSessionLoginCode(freshCode);
    if (freshCode) {
      try {
        const qrData = await buildLoginQrCode(currentUsername, freshCode);
        setSessionLoginQr(qrData);
      } catch {
        setSessionLoginQr("");
      }
    } else {
      setSessionLoginQr("");
    }
    setCodeEmailStatus(
      payload.sentToEmail
        ? `Код отправлен на почту ${payload.maskedEmail || "из профиля"}.`
        : "Почта не найдена, код доступен только здесь."
    );
    setSessionLoginCodeStatus("Код действует 10 минут. Передай его на другое устройство.");
  };

  const loginWithCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const preparedUsername = normalizeUsername(codeLoginUsername.replace("@", ""));
    const preparedCode = codeLoginValue.trim();
    if (!preparedUsername || !preparedCode) {
      setCodeLoginStatus("Укажи username и код.");
      return;
    }

    const response = await postToServer("/api/login/code/verify", {
      username: preparedUsername,
      code: preparedCode,
      deviceName: DEVICE_NAME
    });

    if (!response?.ok) {
      setCodeLoginStatus("Код неверный, истек или аккаунт заблокирован.");
      return;
    }

    const payload = (await response.json()) as {
      profile?: UserProfile;
      session?: { token?: string; id?: string };
      sessions?: DeviceSession[];
    };
    if (!completeCodeLogin(payload)) {
      setCodeLoginStatus("Не удалось войти по коду.");
      return;
    }

    setCodeLoginStatus("");
  };

  const createQrPairForLogin = async () => {
    setQrPairPollStatus("");
    const response = await postToServer("/api/login/qr/pair/create", {
      requesterId: realtimeClientIdRef.current,
      deviceName: DEVICE_NAME,
      baseUrl: typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : ""
    });

    if (!response?.ok) {
      setQrPairCode("");
      setQrPairImage("");
      setQrPairPollStatus("Не удалось создать QR для входа.");
      return;
    }

    const payload = (await response.json()) as { pairCode?: string; approveUrl?: string; expiresInSec?: number };
    const pairCode = payload.pairCode || "";
    setQrPairCode(pairCode);
    if (payload.approveUrl) {
      try {
        const qrData = await QRCode.toDataURL(payload.approveUrl, { width: 260, margin: 1 });
        setQrPairImage(qrData);
      } catch {
        setQrPairImage("");
      }
    }
    setQrPairPollStatus(`QR готов. Отсканируй с устройства, где уже выполнен вход. Код: ${pairCode}`);
  };

  const pollQrPairLogin = async () => {
    if (!qrPairCode) {
      return;
    }

    const response = await postToServer("/api/login/qr/pair/poll", {
      pairCode: qrPairCode,
      requesterId: realtimeClientIdRef.current,
      deviceName: DEVICE_NAME
    });

    if (!response) {
      return;
    }

    if (response.status === 410) {
      setQrPairPollStatus("Срок QR истек. Создай новый код.");
      return;
    }

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      status?: string;
      profile?: UserProfile;
      session?: { token?: string; id?: string };
      sessions?: DeviceSession[];
    };

    if (payload.status === "approved") {
      if (completeCodeLogin(payload)) {
        setQrPairPollStatus("Вход выполнен по QR.");
      }
    }
  };

  const approveQrPairLogin = async () => {
    if (!pendingPairCode || !currentUsername || !sessionToken) {
      return;
    }

    const response = await postToServer("/api/login/qr/pair/approve", {
      pairCode: pendingPairCode,
      username: currentUsername,
      token: sessionToken
    });

    if (!response?.ok) {
      setQrLoginStatus("Не удалось подтвердить вход по QR.");
      return;
    }

    setQrLoginStatus("Запрос входа подтвержден. На другом устройстве вход завершится автоматически.");
    setPendingPairCode("");
    const params = new URLSearchParams(window.location.search);
    params.delete("klanzy_pair");
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  };

  const loginWithQrParams = async (usernameParam: string, codeParam: string) => {
    const preparedUsername = normalizeUsername(usernameParam.replace("@", ""));
    const preparedCode = codeParam.trim();
    if (!preparedUsername || !preparedCode) {
      setQrLoginStatus("QR-код поврежден или пуст.");
      return;
    }

    const response = await postToServer("/api/login/code/verify", {
      username: preparedUsername,
      code: preparedCode,
      deviceName: DEVICE_NAME
    });

    if (!response?.ok) {
      setQrLoginStatus("QR-код истек или неверен. Получи новый в настройках аккаунта.");
      return;
    }

    const payload = (await response.json()) as {
      profile?: UserProfile;
      session?: { token?: string; id?: string };
      sessions?: DeviceSession[];
    };

    if (!completeCodeLogin(payload)) {
      setQrLoginStatus("Не удалось войти через QR-код.");
      return;
    }

    setQrLoginStatus("Вход через QR выполнен.");
  };

  const syncMessageToServer = (chatId: string, message: Message) => {
    void postToServer("/api/messages", {
      chatId,
      message,
      clientId: realtimeClientIdRef.current
    });
  };

  const syncChatToServer = (chat: ChatItem) => {
    void postToServer("/api/chats", {
      chat,
      actorUsername: currentUsername,
      clientId: realtimeClientIdRef.current
    });
  };

  const syncClearChatToServer = (chatId: string) => {
    void postToServer(`/api/chats/${encodeURIComponent(chatId)}/clear`, {
      clientId: realtimeClientIdRef.current
    });
  };

  const syncDeleteMessageToServer = async (chatId: string, messageId: string) => {
    return postToServer("/api/messages/delete", {
      chatId,
      messageId,
      actorUsername: currentUsername,
      clientId: realtimeClientIdRef.current
    });
  };

  const appendMessageToChat = (chatId: string, message: Message) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, message]
            }
          : chat
      )
    );
  };

  const getOfflineGeminiReply = (prompt: string): GeminiReply => {
    const normalized = prompt.toLowerCase();
    const asksForImage = /(сгенер|нарис|создай.*(фото|картин|изображен)|image|photo|picture|арт)/.test(normalized);

    if (asksForImage) {
      const generatedImageUrl = createOfflineAiImage(prompt);
      return {
        text: "Сделал изображение в офлайн-режиме Klanzy Gemini. Нажми на фото, чтобы открыть его на весь экран.",
        generatedImage: generatedImageUrl
          ? {
              url: generatedImageUrl,
              name: `klanzy-gemini-${Date.now()}.png`
            }
          : undefined
      };
    }

    if (/(привет|здар|hello|hi)/.test(normalized)) {
      return { text: "Привет. Я Klanzy Gemini в офлайн-режиме. Могу помочь с текстом, идеями и быстрыми ответами." };
    }
    if (/(помоги|help|что умеешь|возможности)/.test(normalized)) {
      return {
        text: "Я умею: коротко объяснять темы, предлагать идеи, править текст и составлять планы. Напиши задачу в 1-2 предложениях."
      };
    }
    if (/(код|js|javascript|react|html|css)/.test(normalized)) {
      return { text: "Могу подсказать по коду. Опиши, что именно не работает, и я дам пошаговое решение." };
    }
    if (/(ошибка|не работает|bug|баг)/.test(normalized)) {
      return { text: "Давай разберем. Напиши текст ошибки и что ты делал перед тем, как она появилась." };
    }
    if (/(спасибо|благодар)/.test(normalized)) {
      return { text: "Пожалуйста. Если нужно, могу сразу предложить следующий шаг." };
    }

    return {
      text: `Принял: "${prompt.slice(0, 120)}". Я сейчас работаю в простом офлайн-режиме без API ключа, но могу дать краткий совет или план по этой теме.`
    };
  };

  const requestGeminiReply = async (chatMessages: Message[]): Promise<GeminiReply> => {
    if (!aiApiKey.trim()) {
      const lastUserMessage = [...chatMessages].reverse().find((message) => isMessageMine(message))?.text ?? "";
      return getOfflineGeminiReply(lastUserMessage);
    }

    const history = chatMessages.slice(-14).map((message) => ({
      role: isMessageMine(message) ? "user" : "model",
      parts: [{ text: message.text }]
    }));

    const model = aiModel.trim() || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(aiApiKey.trim())}`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Ты бот KlanzyGemini в мессенджере Klanzy. Отвечай по-русски, кратко и по делу, с дружелюбным тоном."
            }
          ]
        },
        contents: history
      })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const errorText = data?.error?.message ?? "Ошибка ответа AI";
      throw new Error(errorText || "Ошибка ответа AI");
    }

    const content = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("\n")
      .trim();
    if (!content || typeof content !== "string") {
      throw new Error("Пустой ответ от AI");
    }

    return { text: content.trim() };
  };

  const sendMessage = async () => {
    const prepared = messageText.trim();
    if (!prepared || isBlocked || isBlockedByOther || (isChannel && !isSubscribed) || !currentUsername) {
      return;
    }

    const outgoingMessage: Message = {
      id: createId(),
      sender: "me",
      senderId: profile.id,
      senderUsername: currentUsername,
      senderNickname: profile.nickname.trim() || currentUsername,
      text: messageReplyTarget ? `Ответ на: ${messageReplyTarget.text}\n${prepared}` : prepared,
      createdAt: formatTime()
    };

    appendMessageToChat(activeChat.id, outgoingMessage);
    syncMessageToServer(activeChat.id, outgoingMessage);
    setMessageText("");
    setMessageReplyTarget(null);

    if (activeChat.id !== GEMINI_CHAT_ID) {
      return;
    }

    setIsAiResponding(true);
    try {
      const reply = await requestGeminiReply([...activeChat.messages, outgoingMessage]);
      const aiMessage: Message = {
        id: createId(),
        sender: "other",
        senderUsername: "@KlanzyGemini",
        senderNickname: "Gemini",
        text: reply.text,
        attachment: reply.generatedImage ? "Фото" : undefined,
        attachmentName: reply.generatedImage?.name,
        attachmentUrl: reply.generatedImage?.url,
        attachmentMime: reply.generatedImage ? "image/png" : undefined,
        createdAt: formatTime()
      };
      appendMessageToChat(GEMINI_CHAT_ID, aiMessage);
      syncMessageToServer(GEMINI_CHAT_ID, aiMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Не удалось получить ответ от AI";
      const aiErrorMessage: Message = {
        id: createId(),
        sender: "other",
        senderUsername: "@KlanzyGemini",
        senderNickname: "Gemini",
        text: `Ошибка Gemini: ${errorMessage}`,
        createdAt: formatTime()
      };
      appendMessageToChat(GEMINI_CHAT_ID, aiErrorMessage);
      syncMessageToServer(GEMINI_CHAT_ID, aiErrorMessage);
    } finally {
      setIsAiResponding(false);
    }
  };

  const onRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const preparedNickname = profile.nickname.trim();
    const preparedUsername = normalizeUsername((profile.username || profile.nickname).replace("@", ""));
    const preparedEmail = (profile.email || "").trim().toLowerCase();

    if (!preparedNickname || !preparedUsername || !preparedEmail) {
      setUsernameError("Заполни ник, @username и почту.");
      return;
    }

    const alreadyUsed = users.some(
      (user) => normalizeUsername((user.username || "").replace("@", "")) === preparedUsername
    );

    const reservedBySystem = chats.some(
      (chat) => chat.username && normalizeUsername(chat.username.replace("@", "")) === preparedUsername
    );

    const emailTaken = users.some((user) => (user.email || "").trim().toLowerCase() === preparedEmail);

    if (alreadyUsed || reservedBySystem || emailTaken) {
      setUsernameError("Этот @username или email уже заняты. Выбери другие.");
      return;
    }

    const profileId = createId();
    const registeredProfile: UserProfile = {
      id: profileId,
      nickname: preparedNickname,
      username: preparedUsername,
      email: preparedEmail,
      badge: preparedUsername === CREATOR_USERNAME ? "creator" : undefined,
      avatar: profile.avatar
    };

    const serverRegistration = await postToServer("/api/register", {
      profile: registeredProfile,
      deviceName: DEVICE_NAME,
      clientId: realtimeClientIdRef.current
    });

    if (serverRegistration?.status === 409) {
      setUsernameError("Этот @username или email уже заняты. Выбери другие.");
      return;
    }

    if (serverRegistration?.ok) {
      try {
        const payload = (await serverRegistration.json()) as {
          users?: UserProfile[];
          session?: { token?: string; id?: string };
        };
        if (Array.isArray(payload.users)) {
          skipUsersRealtimeRef.current = true;
          setUsers(payload.users);
        }
        setSessionToken(payload.session?.token || "");
        setSessionId(payload.session?.id || "");
      } catch {
        // Keep local fallback users update below.
      }
    }

    setProfile(registeredProfile);
    if (!serverRegistration?.ok) {
      setUsers((prev) => [...prev, registeredProfile]);
    }
    setUsernameError("");

    // Send login code to the just provided email right after registration.
    const codeResponse = await postToServer("/api/login/code/request", {
      username: preparedUsername,
      revealCode: false
    });
    if (codeResponse?.ok) {
      const payload = (await codeResponse.json()) as { sentToEmail?: boolean; maskedEmail?: string };
      setCodeEmailStatus(
        payload.sentToEmail
          ? `Код для входа отправлен на ${payload.maskedEmail || preparedEmail}.`
          : "Код не отправлен на почту. В настройках можно получить код вручную."
      );
    } else {
      setCodeEmailStatus("Не удалось отправить код на почту. В настройках можно запросить код вручную.");
    }

    setIsRegistered(true);
  };

  const uploadProfileAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const imageData = await readImage(file);
    setProfile((prev) => ({ ...prev, avatar: imageData }));
  };

  const toggleBlock = async () => {
    if (activeChat.kind !== "direct") {
      return;
    }

    if (!activeChat.username || !currentUsername) {
      return;
    }

    const response = await postToServer("/api/blocks/toggle", {
      actorUsername: currentUsername,
      targetUsername: activeChat.username,
      clientId: realtimeClientIdRef.current
    });

    if (response?.ok) {
      const payload = (await response.json()) as { blocks?: BlockEntry[] };
      if (Array.isArray(payload.blocks)) {
        setBlockEntries(payload.blocks);
      }
      return;
    }

    setBlockedChatIds((prev) =>
      prev.includes(activeChat.id) ? prev.filter((id) => id !== activeChat.id) : [...prev, activeChat.id]
    );
  };

  const setUserBanState = async (targetUsername: string, banned: boolean) => {
    const response = await postToServer("/api/admin/ban", {
      actorUsername: currentUsername,
      targetUsername,
      banned,
      clientId: realtimeClientIdRef.current
    });
    if (!response?.ok) {
      setAdminActionStatus("Не удалось обновить бан пользователя.");
      return;
    }
    const payload = (await response.json()) as { users?: UserProfile[] };
    if (Array.isArray(payload.users)) {
      skipUsersRealtimeRef.current = true;
      setUsers(payload.users);
    }
    setAdminActionStatus(banned ? `Пользователь ${targetUsername} заблокирован.` : `Пользователь ${targetUsername} разблокирован.`);
  };

  const deleteManagedChat = async (chatId: string) => {
    const response = await postToServer("/api/admin/chat/delete", {
      actorUsername: currentUsername,
      chatId,
      clientId: realtimeClientIdRef.current
    });
    if (!response?.ok) {
      setAdminActionStatus("Не удалось удалить канал или группу.");
      return;
    }
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    setAdminActionStatus("Канал или группа удалены.");
  };

  const deleteUserAccountByAdmin = async (targetUsername: string) => {
    const response = await postToServer("/api/admin/user/delete", {
      actorUsername: currentUsername,
      targetUsername,
      clientId: realtimeClientIdRef.current
    });
    if (!response?.ok) {
      setAdminActionStatus("Не удалось удалить аккаунт.");
      return;
    }
    const payload = (await response.json()) as { users?: UserProfile[]; blocks?: BlockEntry[] };
    if (Array.isArray(payload.users)) {
      skipUsersRealtimeRef.current = true;
      setUsers(payload.users);
    }
    if (Array.isArray(payload.blocks)) {
      setBlockEntries(payload.blocks);
    }
    setChats((prev) => prev.filter((chat) => normalizeUsername((chat.username || "").replace("@", "")) !== targetUsername));
    setAdminActionStatus(`Аккаунт ${targetUsername} удален.`);
  };

  const adminSendMessageToAnyChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminMessageChatId || !adminMessageText.trim()) {
      return;
    }

    const response = await postToServer("/api/admin/message", {
      actorUsername: currentUsername,
      chatId: adminMessageChatId,
      text: adminMessageText,
      clientId: realtimeClientIdRef.current
    });

    if (!response?.ok) {
      setAdminActionStatus("Не удалось отправить админ-сообщение.");
      return;
    }

    setAdminMessageText("");
    setAdminActionStatus("Админ-сообщение отправлено.");
  };

  const setUserBadgeByAdmin = async () => {
    const targetUsername = normalizeUsername(adminBadgeUser.replace("@", ""));
    if (!targetUsername) {
      setAdminActionStatus("Укажи корректный @username для бейджа.");
      return;
    }

    const response = await postToServer("/api/admin/badge/set", {
      actorUsername: currentUsername,
      targetUsername,
      badge: adminBadgeValue,
      clientId: realtimeClientIdRef.current
    });

    if (!response?.ok) {
      setAdminActionStatus("Не удалось выдать бейдж.");
      return;
    }

    const payload = (await response.json()) as { users?: UserProfile[] };
    if (Array.isArray(payload.users)) {
      skipUsersRealtimeRef.current = true;
      setUsers(payload.users);
    }
    setAdminActionStatus(`Бейдж обновлен для ${targetUsername}.`);
  };

  const clearAllLoginCodesByAdmin = async () => {
    const response = await postToServer("/api/admin/login-codes/clear", {
      actorUsername: currentUsername
    });
    if (!response?.ok) {
      setAdminActionStatus("Не удалось очистить коды входа.");
      return;
    }
    setAdminActionStatus("Все активные коды входа очищены.");
  };

  const revokeUserSessionsByAdmin = async () => {
    const targetUsername = normalizeUsername(adminSessionUser.replace("@", ""));
    if (!targetUsername) {
      setAdminActionStatus("Укажи @username для отключения сессий.");
      return;
    }
    const response = await postToServer("/api/admin/sessions/revoke-user", {
      actorUsername: currentUsername,
      targetUsername,
      clientId: realtimeClientIdRef.current
    });
    if (!response?.ok) {
      setAdminActionStatus("Не удалось отключить устройства пользователя.");
      return;
    }
    setAdminActionStatus(`Все устройства пользователя ${targetUsername} отключены.`);
  };

  const refreshDeviceSessions = async () => {
    if (!currentUsername || !sessionToken) {
      return;
    }

    const response = await postToServer("/api/sessions/list", {
      username: currentUsername,
      token: sessionToken
    });

    if (!response?.ok) {
      setDeviceActionStatus("Не удалось загрузить устройства.");
      return;
    }

    const payload = (await response.json()) as { sessions?: DeviceSession[] };
    if (Array.isArray(payload.sessions)) {
      setDeviceSessions(payload.sessions);
      setDeviceActionStatus("Список устройств обновлен.");
    }
  };

  const revokeDeviceSession = async (targetSessionId?: string, revokeAll = false) => {
    if (!currentUsername || !sessionToken) {
      setDeviceActionStatus("Сначала войди в аккаунт на этом устройстве.");
      return;
    }

    const response = await postToServer("/api/sessions/revoke", {
      username: currentUsername,
      token: sessionToken,
      targetSessionId,
      revokeAll,
      clientId: realtimeClientIdRef.current
    });

    if (!response?.ok) {
      setDeviceActionStatus("Не удалось завершить сессию.");
      return;
    }

    const payload = (await response.json()) as { sessions?: DeviceSession[] };
    if (Array.isArray(payload.sessions)) {
      setDeviceSessions(payload.sessions);
    }
    setDeviceActionStatus(revokeAll ? "Все другие устройства отключены." : "Устройство отключено.");
  };

  const setActiveChatAdminState = async (targetUsername: string, value: boolean) => {
    if (!canManageActiveChat) {
      setChatManageStatus("У вас нет прав на управление админами чата.");
      return;
    }

    const response = await postToServer("/api/chats/admins/set", {
      actorUsername: currentUsername,
      targetUsername,
      chatId: activeChat.id,
      isAdmin: value,
      clientId: realtimeClientIdRef.current
    });

    if (!response?.ok) {
      setChatManageStatus("Не удалось обновить админа чата.");
      return;
    }

    const payload = (await response.json()) as { chatAdmins?: ChatAdminEntry[] };
    if (Array.isArray(payload.chatAdmins)) {
      setChatAdmins(payload.chatAdmins);
    }
    setChatManageStatus(value ? `Назначен админ: ${targetUsername}` : `Снят админ: ${targetUsername}`);
  };

  const deleteActiveGroupOrChannel = async () => {
    if (!canManageActiveChat) {
      setChatManageStatus("У вас нет прав для удаления этого чата.");
      return;
    }

    const shouldDelete = window.confirm(`Удалить ${activeChat.kind === "channel" ? "канал" : "группу"} ${activeChat.title}?`);
    if (!shouldDelete) {
      return;
    }

    const endpoint = isAdmin ? "/api/admin/chat/delete" : "/api/chats/delete";
    const response = await postToServer(endpoint, {
      actorUsername: currentUsername,
      chatId: activeChat.id,
      clientId: realtimeClientIdRef.current
    });

    if (!response?.ok) {
      setChatManageStatus("Не удалось удалить группу или канал.");
      return;
    }

    setChats((prev) => prev.filter((chat) => chat.id !== activeChat.id));
    setChatManageStatus("Группа или канал удалены.");
  };

  const toggleSubscribe = () => {
    if (!isChannel) {
      return;
    }
    setChats((prev) =>
      prev.map((chat) => (chat.id === activeChat.id ? { ...chat, subscribed: !chat.subscribed } : chat))
    );
  };

  const clearActiveChatHistory = () => {
    const shouldClear = window.confirm(`Очистить всю историю в чате ${activeChat.title}?`);
    if (!shouldClear) {
      return;
    }

    setChats((prev) => prev.map((chat) => (chat.id === activeChat.id ? { ...chat, messages: [] } : chat)));
    syncClearChatToServer(activeChat.id);

    if (activeChat.id === GEMINI_CHAT_ID) {
      setIsAiResponding(false);
    }
  };

  const closeMessageActionMenu = () => {
    setMessageActionMenu(null);
  };

  const openMessageActionMenu = (payload: { chatId: string; messageId: string; x: number; y: number }) => {
    setMessageActionMenu(payload);
  };

  const copyMessage = async (message: Message) => {
    const composed = [message.text, message.attachmentName ? `Вложение: ${message.attachmentName}` : ""]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(composed || "");
    } catch {
      window.prompt("Скопируй текст вручную:", composed || "");
    }
  };

  const deleteMessage = async (chatId: string, messageId: string) => {
    const response = await syncDeleteMessageToServer(chatId, messageId);
    if (response && !response.ok) {
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.filter((message) => message.id !== messageId)
            }
          : chat
      )
    );
  };

  const sendGiftFromCreator = (message: Message) => {
    if (currentUsername !== CREATOR_USERNAME) {
      return;
    }

    const giftName = window.prompt("Название подарка:", "Premium Gift");
    if (!giftName?.trim()) {
      return;
    }

    const recipient = message.senderNickname || message.senderUsername || "пользователь";
    const giftMessage: Message = {
      id: createId(),
      sender: "me",
      senderId: profile.id,
      senderUsername: currentUsername,
      senderNickname: profile.nickname.trim() || currentUsername,
      text: `Подарок: ${giftName.trim()} отправлен для ${recipient} (бесплатно).`,
      createdAt: formatTime()
    };
    appendMessageToChat(activeChat.id, giftMessage);
    syncMessageToServer(activeChat.id, giftMessage);
  };

  const forwardMessage = (message: Message) => {
    const availableChats = chats.filter((chat) => chat.id !== activeChat.id);
    if (availableChats.length === 0) {
      return;
    }

    const options = availableChats.map((chat, index) => `${index + 1}. ${chat.title}`).join("\n");
    const selected = window.prompt(`Куда переслать сообщение?\n${options}\n\nВведи номер чата:`);
    const parsed = Number.parseInt(selected ?? "", 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > availableChats.length) {
      return;
    }

    const targetChat = availableChats[parsed - 1];
    const forwardedMessage: Message = {
      id: createId(),
      sender: "me",
      senderId: profile.id,
      senderUsername: currentUsername,
      senderNickname: profile.nickname.trim() || currentUsername,
      text: `Переслано: ${message.text}`,
      attachment: message.attachment,
      attachmentName: message.attachmentName,
      attachmentUrl: message.attachmentUrl,
      attachmentMime: message.attachmentMime,
      createdAt: formatTime()
    };
    appendMessageToChat(targetChat.id, forwardedMessage);
    syncMessageToServer(targetChat.id, forwardedMessage);
  };

  const handleMessageAction = async (action: "copy" | "forward" | "delete" | "reply" | "pin" | "gift") => {
    if (!messageActionMenu) {
      return;
    }

    const targetChat = chats.find((chat) => chat.id === messageActionMenu.chatId);
    const targetMessage = targetChat?.messages.find((message) => message.id === messageActionMenu.messageId);
    if (!targetMessage) {
      closeMessageActionMenu();
      return;
    }

    if (action === "copy") {
      await copyMessage(targetMessage);
    }

    if (action === "forward") {
      forwardMessage(targetMessage);
    }

    if (action === "delete") {
      await deleteMessage(messageActionMenu.chatId, messageActionMenu.messageId);
    }

    if (action === "reply") {
      setMessageReplyTarget({
        id: targetMessage.id,
        text: targetMessage.text.slice(0, 80)
      });
    }

    if (action === "pin") {
      setPinnedByChat((prev) => ({
        ...prev,
        [messageActionMenu.chatId]: targetMessage.id
      }));
    }

    if (action === "gift") {
      sendGiftFromCreator(targetMessage);
    }

    closeMessageActionMenu();
  };

  const createConversation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createTitle.trim()) {
      return;
    }

    const newChat: ChatItem = {
      id: createId(),
      title: createTitle,
      username: createUsername.trim() ? normalizeUsername(createUsername) : undefined,
      kind: createType,
      visibility: createVisibility,
      subscribed: createType === "channel" ? true : undefined,
      ownerUsername: currentUsername,
      messages: [
        {
          id: createId(),
          sender: "other",
          text:
            createType === "channel"
              ? "Канал создан. Опубликуйте первую новость."
              : "Группа создана. Позовите участников.",
          createdAt: formatTime()
        }
      ]
    };

    setChats((prev) => [newChat, ...prev]);
    syncChatToServer(newChat);
    setActiveChatId(newChat.id);
    setShowCreateForm(false);
    setCreateTitle("");
    setCreateUsername("");
    setActiveSection("chats");
  };

  const openOrCreateDirectChat = (targetUsername?: string, targetLabel?: string) => {
    const normalizedTarget = normalizeUsername((targetUsername ?? "").replace("@", ""));
    if (!normalizedTarget || normalizedTarget === currentUsername) {
      return;
    }

    const existingDirect = chats.find(
      (chat) =>
        chat.kind === "direct" &&
        chat.username &&
        normalizeUsername(chat.username.replace("@", "")) === normalizedTarget
    );

    if (existingDirect) {
      setActiveChatId(existingDirect.id);
      setActiveSection("chats");
      return;
    }

    const newDirect: ChatItem = {
      id: createId(),
      title: targetLabel?.trim() || normalizedTarget.replace("@", ""),
      username: normalizedTarget,
      kind: "direct",
      visibility: "open",
      messages: [
        {
          id: createId(),
          sender: "other",
          senderUsername: normalizedTarget,
          senderNickname: targetLabel?.trim() || normalizedTarget,
          text: "Чат создан. Напиши первое сообщение.",
          createdAt: formatTime()
        }
      ]
    };

    setChats((prev) => [newDirect, ...prev]);
    syncChatToServer(newDirect);
    setActiveChatId(newDirect.id);
    setActiveSection("chats");
  };

  const onAttachmentSelect = (kind: AttachmentType) => {
    setPendingAttachmentType(kind);
    setShowAttachmentMenu(false);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.accept =
        kind === "Фото"
          ? "image/*"
          : kind === "Видео"
            ? "video/*"
            : kind === "Музыка"
              ? "audio/*"
              : "*/*";
      attachmentInputRef.current.click();
    }
  };

  const onAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isBlocked || isBlockedByOther || (isChannel && !isSubscribed) || !currentUsername) {
      return;
    }

    const fileUrl = await readImage(file);

    const attachmentMessage: Message = {
      id: createId(),
      sender: "me",
      senderId: profile.id,
      senderUsername: currentUsername,
      senderNickname: profile.nickname.trim() || currentUsername,
      text: `${pendingAttachmentType}: ${truncateFileName(file.name)}`,
      attachment: pendingAttachmentType,
      attachmentName: file.name,
      attachmentUrl: fileUrl,
      attachmentMime: file.type,
      createdAt: formatTime()
    };

    appendMessageToChat(activeChat.id, attachmentMessage);
    syncMessageToServer(activeChat.id, attachmentMessage);

    event.target.value = "";
  };

  const startOrResumeDownload = (source: { sourceId: string; title: string; chatTitle: string; url: string }) => {
    setDownloads((prev) => {
      const existing = prev.find((item) => item.sourceId === source.sourceId);
      if (existing) {
        return prev.map((item) =>
          item.sourceId === source.sourceId
            ? {
                ...item,
                status: item.status === "done" ? "done" : "downloading"
              }
            : item
        );
      }

      return [
        {
          id: createId(),
          sourceId: source.sourceId,
          title: source.title,
          chatTitle: source.chatTitle,
          url: source.url,
          progress: 0,
          status: "downloading"
        },
        ...prev
      ];
    });
  };

  const pauseDownload = (sourceId: string) => {
    setDownloads((prev) =>
      prev.map((item) => (item.sourceId === sourceId ? { ...item, status: "paused" } : item))
    );
  };

  useEffect(() => {
    if (!isRegistered || !currentUsername || !sessionToken) {
      return;
    }

    void refreshDeviceSessions();
  }, [isRegistered, currentUsername, sessionToken]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const pairCode = getPairCodeFromQuery();
    if (pairCode) {
      setPendingPairCode(pairCode);
    }

    if (isRegistered) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const usernameFromQr = params.get("klanzy_user") || "";
    const codeFromQr = params.get("klanzy_code") || "";
    if (!usernameFromQr || !codeFromQr) {
      return;
    }

    setAuthMode("login");
    void loginWithQrParams(usernameFromQr, codeFromQr).finally(() => {
      params.delete("klanzy_user");
      params.delete("klanzy_code");
      const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", cleanUrl);
    });
  }, [isRegistered]);

  useEffect(() => {
    if (isRegistered || !qrPairCode) {
      return;
    }

    const timer = window.setInterval(() => {
      void pollQrPairLogin();
    }, 1800);

    return () => window.clearInterval(timer);
  }, [isRegistered, qrPairCode]);

  if (!isRegistered) {
    return (
      <div className={`relative min-h-screen overflow-hidden p-6 klanzy-fade-in ${containerClass}`} style={pageBackgroundStyle}>
        <div
          className="pointer-events-none absolute -left-16 top-10 h-72 w-72 animate-pulse rounded-full blur-3xl"
          style={{ backgroundColor: hexToRgba(accent.primary, 0.25) }}
        />
        <div
          className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 animate-pulse rounded-full blur-3xl [animation-delay:700ms]"
          style={{ backgroundColor: hexToRgba(accent.secondary, 0.22) }}
        />

        <div className={`mx-auto mt-10 w-full max-w-xl rounded-[2rem] p-8 shadow-2xl transition-all duration-500 klanzy-panel-enter ${panelClass}`} style={panelStyle}>
          <p className="text-sm uppercase tracking-[0.25em]" style={{ color: accent.text }}>
            Klanzy Messenger
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAuthMode("register")}
              style={authMode === "register" ? accentButtonStyle : accentSurfaceStyle}
              className={`rounded-xl py-2 text-sm ${authMode === "register" ? "text-white" : ""}`}
            >
              Регистрация
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              style={authMode === "login" ? accentButtonStyle : accentSurfaceStyle}
              className={`rounded-xl py-2 text-sm ${authMode === "login" ? "text-white" : ""}`}
            >
              Вход
            </button>
          </div>

          {authMode === "register" ? (
            <form onSubmit={onRegister}>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">Регистрация</h1>
              <p className="mt-2 max-w-md text-sm text-slate-400">Создай профиль и переходи к чатам, каналам и событиям.</p>

              <div className="mt-7 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => registerAvatarInputRef.current?.click()}
                  className="group relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-full border-2"
                  style={accentSoftStyle}
                  aria-label="Выбрать аватарку"
                >
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-3xl">+</span>
                  )}
                  <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                </button>
                <div className="text-sm text-slate-400">Нажми на круг, чтобы выбрать аватарку.</div>
                <input
                  ref={registerAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadProfileAvatar}
                />
              </div>

              <label className="mt-6 block text-sm text-slate-300">Ник</label>
              <input
                value={profile.nickname}
                onChange={(event) => {
                  const nextNickname = event.target.value;
                  setProfile((prev) => ({
                    ...prev,
                    nickname: nextNickname,
                    username: normalizeUsername(nextNickname)
                  }));
                  setUsernameError("");
                }}
                className="mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none transition focus:ring-2"
                style={accentInputStyle}
                placeholder="Например, Klanzy User"
                required
              />

              <label className="mt-4 block text-sm text-slate-300">@Username</label>
              <input
                value={profile.username}
                onChange={(event) => {
                  setProfile((prev) => ({ ...prev, username: normalizeUsername(event.target.value.replace("@", "")) }));
                  setUsernameError("");
                }}
                className="mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none transition focus:ring-2"
                style={accentInputStyle}
                placeholder="@Username"
              />

              <label className="mt-4 block text-sm text-slate-300">Почта</label>
              <input
                value={profile.email || ""}
                onChange={(event) => {
                  setProfile((prev) => ({ ...prev, email: event.target.value }));
                  setUsernameError("");
                }}
                type="email"
                className="mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none transition focus:ring-2"
                style={accentInputStyle}
                placeholder="name@example.com"
                required
              />
              {usernameError && <p className="mt-2 text-xs text-rose-300">{usernameError}</p>}

              <div className="mt-4 rounded-2xl border p-3" style={accentSoftStyle}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-200">Лайт режим</p>
                    <p className="text-xs text-slate-400">Можно включить сразу при регистрации для слабых устройств.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLiteMode((prev) => !prev)}
                    style={liteMode ? accentButtonStyle : accentSurfaceStyle}
                    className={`rounded-xl px-3 py-1.5 text-xs ${liteMode ? "text-white" : ""}`}
                  >
                    {liteMode ? "Включен" : "Выключен"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={accentButtonStyle}
                className="mt-6 w-full rounded-2xl px-4 py-3 text-lg font-medium transition hover:scale-[1.01]"
              >
                Войти в Klanzy
              </button>
            </form>
          ) : (
            <div className="mt-4 space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight">Вход</h1>
              <p className="text-sm text-slate-400">Вход по коду и по QR объединены в один экран.</p>
              <form onSubmit={loginWithCode} className="space-y-3 rounded-2xl border p-3" style={accentSoftStyle}>
                <p className="text-sm text-slate-200">Вход по коду</p>
                <input
                  value={codeLoginUsername}
                  onChange={(event) => {
                    setCodeLoginUsername(event.target.value);
                    setCodeLoginStatus("");
                  }}
                  className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                  style={accentInputStyle}
                  placeholder="@Username"
                  required
                />
                <input
                  value={codeLoginValue}
                  onChange={(event) => {
                    setCodeLoginValue(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setCodeLoginStatus("");
                  }}
                  className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                  style={accentInputStyle}
                  placeholder="123456"
                  maxLength={6}
                  required
                />
                <button type="submit" style={accentButtonStyle} className="w-full rounded-xl px-4 py-2 text-white">
                  Войти по коду
                </button>
                {codeLoginStatus && <p className="text-xs text-amber-300">{codeLoginStatus}</p>}
              </form>

              <div className="space-y-3 rounded-2xl border p-3" style={accentSoftStyle}>
                <p className="text-sm text-slate-200">Вход по QR между устройствами</p>
                <button type="button" onClick={() => void createQrPairForLogin()} style={accentButtonStyle} className="w-full rounded-xl px-4 py-2 text-white">
                  Сгенерировать QR для входа
                </button>
                {qrPairCode && <p className="text-center text-lg tracking-[0.2em]">{qrPairCode}</p>}
                {qrPairImage && <img src={qrPairImage} alt="QR для входа" className="mx-auto h-44 w-44 rounded-lg bg-white p-1" />}
                {qrPairPollStatus && <p className="text-xs text-slate-300">{qrPairPollStatus}</p>}
              </div>

              {qrLoginStatus && <p className="text-xs text-amber-300">{qrLoginStatus}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative min-h-screen overflow-hidden p-4 sm:p-6 ${liteMode ? "klanzy-lite" : "klanzy-fade-in"} ${containerClass}`}
      style={pageBackgroundStyle}
    >
      {!liteMode && <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full blur-3xl" style={accentSurfaceStyle} />}
      {!liteMode && (
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${accent.secondary}33` }}
        />
      )}

      {pendingPairCode && (
        <div className="relative mx-auto mb-3 max-w-7xl rounded-2xl border px-4 py-3 text-sm" style={accentSoftStyle}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>Запрос QR-входа: {pendingPairCode}</p>
            <button type="button" onClick={() => void approveQrPairLogin()} className="rounded-xl px-3 py-2 text-white" style={accentButtonStyle}>
              Подтвердить вход
            </button>
          </div>
        </div>
      )}

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <aside className={`rounded-[2rem] p-4 transition-all duration-500 klanzy-panel-enter ${panelClass}`} style={panelStyle}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl">
              {profile.avatar ? (
                <img src={profile.avatar} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-indigo-500/30 text-lg">K</div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 font-medium">
                <span>{profile.nickname}</span>
                {renderBadge(currentUser?.badge || profile.badge, "sm")}
              </div>
              <div className="text-xs text-slate-400">{profile.username || "@Username"}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-sm">
            {[
              { id: "chats", label: "Чаты" },
              { id: "search", label: "Поиск" },
              { id: "events", label: "Эвенты" },
              { id: "settings", label: "Настр." }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as SectionTab)}
                  style={activeSection === tab.id ? accentButtonStyle : undefined}
                  className={`rounded-xl px-2 py-2 transition ${
                    activeSection === tab.id ? "text-white" : "bg-transparent hover:bg-indigo-500/20"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeSection === "chats" && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-300">Диалоги</h2>
                 <button
                  type="button"
                   className="rounded-xl border px-3 py-1 text-xs"
                   style={accentInputStyle}
                  onClick={() => setShowCreateForm((prev) => !prev)}
                >
                  Создать
                </button>
              </div>

              {showCreateForm && (
                <form onSubmit={createConversation} className="space-y-2 rounded-2xl border p-3 text-sm" style={accentSoftStyle}>
                  <input
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.target.value)}
                    placeholder="Название"
                    className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                    style={accentInputStyle}
                    required
                  />
                  <input
                    value={createUsername}
                    onChange={(event) => setCreateUsername(event.target.value)}
                    placeholder="Username (необязательно)"
                    className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                    style={accentInputStyle}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={createType}
                      onChange={(event) => setCreateType(event.target.value as "group" | "channel")}
                      className="rounded-xl border bg-transparent px-2 py-2 outline-none"
                      style={accentInputStyle}
                    >
                      <option value="group">Группа</option>
                      <option value="channel">Канал</option>
                    </select>
                    <select
                      value={createVisibility}
                      onChange={(event) => setCreateVisibility(event.target.value as "open" | "private")}
                      className="rounded-xl border bg-transparent px-2 py-2 outline-none"
                      style={accentInputStyle}
                    >
                      <option value="open">Открытый</option>
                      <option value="private">Закрытый</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full rounded-xl bg-indigo-500 py-2 text-white">
                    Готово
                  </button>
                </form>
              )}

              <div className="space-y-1">
                {visibleChatList.length === 0 && (
                  <p className="rounded-2xl border p-3 text-xs text-slate-400" style={accentSoftStyle}>
                    Групп и каналов пока нет. Создай свой — он будет виден только тебе и тем, кому ты назначишь админку.
                  </p>
                )}
                {visibleChatList.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setActiveSection("chats");
                    }}
                    style={activeChatId === chat.id ? accentSoftStyle : undefined}
                    className="w-full rounded-2xl p-3 text-left transition hover:opacity-90 klanzy-item-enter"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{chat.title}</div>
                      <span style={accentChipStyle} className={`rounded-full px-2 py-0.5 text-[10px] ${accentChipClass}`}>
                        {chat.visibility}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">{chat.username ?? "без username"}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSection === "search" && (
            <div className="relative mt-4 space-y-3 overflow-hidden pb-28">
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Поиск по Klanzy"
                className="w-full rounded-2xl border bg-transparent px-3 py-2 outline-none"
                style={accentInputStyle}
              />

              <div className="grid grid-cols-2 gap-2 text-xs">
                {searchTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveSearchTab(tab)}
                    style={activeSearchTab === tab ? accentButtonStyle : accentSurfaceStyle}
                    className={`rounded-xl px-2 py-2 ${activeSearchTab === tab ? "text-white" : ""}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeSearchTab === "Загрузки" ? (
                <div className="space-y-2">
                  {filteredDownloadSources.length === 0 && (
                    <p className="text-sm text-slate-400">Загрузки не найдены.</p>
                  )}

                  {filteredDownloadSources.map((source) => {
                    const downloadState = downloads.find((item) => item.sourceId === source.sourceId);
                    const progress = downloadState?.progress ?? 0;
                    const status = downloadState?.status;

                    return (
                      <div key={source.sourceId} className="rounded-xl p-2 klanzy-item-enter" style={accentSurfaceStyle}>
                        <p className="text-sm font-medium break-all">{truncateFileName(source.title, 42)}</p>
                        <p className="text-xs text-slate-400">Чат: {source.chatTitle}</p>

                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${progress}%`, backgroundColor: accent.primary }}
                          />
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-xs">
                          {!status && (
                            <button
                              type="button"
                              onClick={() => startOrResumeDownload(source)}
                              style={accentButtonStyle}
                              className="rounded-lg px-2 py-1 text-white"
                            >
                              Скачать
                            </button>
                          )}

                          {status === "downloading" && (
                            <>
                              <span className="text-slate-300">Скачивается: {progress}%</span>
                              <button
                                type="button"
                                onClick={() => pauseDownload(source.sourceId)}
                                className="rounded-lg px-2 py-1"
                                style={accentSoftStyle}
                              >
                                Пауза
                              </button>
                            </>
                          )}

                          {status === "paused" && (
                            <>
                              <span className="text-amber-300">Пауза: {progress}%</span>
                              <button
                                type="button"
                                onClick={() => startOrResumeDownload(source)}
                                style={accentButtonStyle}
                                className="rounded-lg px-2 py-1 text-white"
                              >
                                Продолжить
                              </button>
                            </>
                          )}

                          {status === "done" && (
                            <a
                              href={source.url}
                              download={source.title}
                              className="rounded-lg px-2 py-1 underline-offset-2 hover:underline"
                              style={accentSoftStyle}
                            >
                              Файл готов. Скачать
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.length === 0 && <p className="text-sm text-slate-400">Ничего не найдено.</p>}
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        if (result.entityKind === "user") {
                          openOrCreateDirectChat(result.username, result.label);
                          return;
                        }

                        if (result.entityKind === "chat" && chats.some((chat) => chat.id === result.id)) {
                          setActiveChatId(result.id);
                          setActiveSection("chats");
                        }
                      }}
                      className="w-full rounded-xl p-2 text-left transition hover:opacity-90 klanzy-item-enter"
                      style={accentSurfaceStyle}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span>{result.label}</span>
                        {result.entityKind === "user" && renderBadge(getBadgeForUsername(result.username), "sm")}
                      </div>
                      <div className="text-xs text-slate-400">
                        {result.username ?? result.type}
                        {result.entityKind === "user" ? " • Пользователь" : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showPoppyHands && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24">
                  <div className="absolute bottom-0 left-0 klanzy-hand-rise-left">
                    <svg viewBox="0 0 200 120" className="h-20 w-28" aria-hidden="true">
                      <path
                        d="M15 115c16-26 18-43 28-62 6-12 14-17 24-13 9 4 11 15 8 26-2 7-6 15-10 24 10-14 16-29 26-40 7-8 15-10 22-4 8 6 8 14 4 24-2 6-7 14-13 24 9-9 16-18 24-25 9-8 17-8 23-2 7 7 6 17-1 27-7 10-17 20-28 31l83-2v12H15Z"
                        fill="#2b7fff"
                        opacity="0.9"
                      />
                      <path
                        d="M18 115c14-22 16-37 26-55 5-10 13-14 21-11 7 3 8 11 6 19-2 7-6 13-9 20"
                        stroke="#9bd6ff"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <div className="absolute bottom-0 right-0 klanzy-hand-rise-right">
                    <svg viewBox="0 0 200 120" className="h-20 w-28" aria-hidden="true">
                      <path
                        d="M185 115c-16-26-18-43-28-62-6-12-14-17-24-13-9 4-11 15-8 26 2 7 6 15 10 24-10-14-16-29-26-40-7-8-15-10-22-4-8 6-8 14-4 24 2 6 7 14 13 24-9-9-16-18-24-25-9-8-17-8-23-2-7 7-6 17 1 27 7 10 17 20 28 31l-83-2v12h190Z"
                        fill="#ef4444"
                        opacity="0.9"
                      />
                      <path
                        d="M182 115c-14-22-16-37-26-55-5-10-13-14-21-11-7 3-8 11-6 19 2 7 6 13 9 20"
                        stroke="#fecaca"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === "events" && (
              <div className="mt-6 rounded-3xl border p-5 text-center" style={accentSoftStyle}>
              <h2 className="text-xl font-semibold">Эвенты</h2>
              <p className="mt-2 text-slate-300">Скоро...</p>
              <p className="mt-1 text-xs text-slate-400">xx.xx.2026</p>
            </div>
          )}

          {activeSection === "settings" && (
            <div className="mt-4 space-y-4 text-sm">
              <div className={`grid gap-2 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
                <button
                  type="button"
                  onClick={() => setActiveSettingsTab("profile")}
                  style={activeSettingsTab === "profile" ? accentButtonStyle : accentSurfaceStyle}
                  className={`rounded-xl py-2 ${activeSettingsTab === "profile" ? "text-white" : ""}`}
                >
                  Профиль
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSettingsTab("themes")}
                  style={activeSettingsTab === "themes" ? accentButtonStyle : accentSurfaceStyle}
                  className={`rounded-xl py-2 ${activeSettingsTab === "themes" ? "text-white" : ""}`}
                >
                  Темы
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab("admin")}
                    style={activeSettingsTab === "admin" ? accentButtonStyle : accentSurfaceStyle}
                    className={`rounded-xl py-2 ${activeSettingsTab === "admin" ? "text-white" : ""}`}
                  >
                    Админ
                  </button>
                )}
              </div>

              {activeSettingsTab === "themes" && (
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 text-slate-400">Режим</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        style={theme === "dark" ? accentButtonStyle : accentSurfaceStyle}
                        className={`rounded-xl py-2 ${theme === "dark" ? "text-white" : ""}`}
                      >
                        Темная
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        style={theme === "light" ? accentButtonStyle : accentSurfaceStyle}
                        className={`rounded-xl py-2 ${theme === "light" ? "text-white" : ""}`}
                      >
                        Светлая
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-slate-200">Лайт режим</p>
                        <p className="text-xs text-slate-400">Упрощает анимации и эффекты для слабых устройств.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLiteMode((prev) => !prev)}
                        style={liteMode ? accentButtonStyle : accentSurfaceStyle}
                        className={`rounded-xl px-3 py-1.5 text-xs ${liteMode ? "text-white" : ""}`}
                      >
                        {liteMode ? "Включен" : "Выключен"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-slate-400">Цветовая тема</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "blueviolet", label: "Кланзи" },
                        { key: "mandarin", label: "Мандарин" },
                        { key: "apple", label: "Яблоко" },
                        { key: "strawberry", label: "Клубника" },
                         { key: "lemon", label: "Лимон" },
                         { key: "ocean", label: "Океан" },
                         { key: "orchid", label: "Орхидея" },
                         { key: "graphite", label: "Графит" }
                      ].map((palette) => (
                        <button
                          key={palette.key}
                          type="button"
                          onClick={() => setAccentTheme(palette.key as AccentTheme)}
                          className={`rounded-xl px-2 py-2 text-sm ${accentTheme === palette.key ? "text-white" : ""}`}
                          style={accentTheme === palette.key ? accentButtonStyle : accentSurfaceStyle}
                        >
                          {palette.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "profile" && (
                <>
                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <p className="mb-2 text-slate-300">Аватарка</p>
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-full border" style={accentInputStyle}>
                        {profile.avatar ? (
                          <img src={profile.avatar} alt="avatar" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg">K</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="rounded-xl px-3 py-2 text-xs text-white"
                        style={accentButtonStyle}
                      >
                        Изменить аватарку
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={uploadProfileAvatar}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-slate-400">Ник</label>
                    <input
                      value={profile.nickname}
                      onChange={(event) => {
                        setProfile((prev) => ({ ...prev, nickname: event.target.value }));
                        setProfileSaveError("");
                        setProfileSaveStatus("");
                      }}
                      className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                      style={accentInputStyle}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-slate-400">Username</label>
                    <input
                      value={profile.username}
                      onChange={(event) => {
                        setProfile((prev) => ({ ...prev, username: normalizeUsername(event.target.value.replace("@", "")) }));
                        setProfileSaveError("");
                        setProfileSaveStatus("");
                      }}
                      placeholder="@Username"
                      className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                      style={accentInputStyle}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-slate-400">Почта</label>
                    <input
                      value={profile.email || ""}
                      onChange={(event) => {
                        setProfile((prev) => ({ ...prev, email: event.target.value }));
                        setProfileSaveError("");
                        setProfileSaveStatus("");
                      }}
                      type="email"
                      placeholder="name@example.com"
                      className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                      style={accentInputStyle}
                    />
                  </div>

                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-slate-200">Вход на другом устройстве</p>
                        <p className="text-xs text-slate-400">Создай код и используй его в режиме "Вход по коду".</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void requestSessionLoginCode()}
                        className="rounded-xl px-3 py-1.5 text-xs text-white"
                        style={accentButtonStyle}
                      >
                        Получить код
                      </button>
                    </div>
                    {sessionLoginCode && (
                      <p className="mt-2 text-lg font-semibold tracking-[0.2em]">{sessionLoginCode}</p>
                    )}
                    {sessionLoginQr && (
                      <div className="mt-2 rounded-xl border p-2" style={accentInputStyle}>
                        <p className="mb-2 text-xs text-slate-400">QR для входа на другом устройстве</p>
                        <img src={sessionLoginQr} alt="QR для входа" className="h-44 w-44 rounded-lg bg-white p-1" />
                      </div>
                    )}
                    {sessionLoginCodeStatus && <p className="mt-1 text-xs text-slate-300">{sessionLoginCodeStatus}</p>}
                    {codeEmailStatus && <p className="mt-1 text-xs text-slate-300">{codeEmailStatus}</p>}
                  </div>

                  {pendingPairCode && (
                    <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                      <p className="text-slate-200">Найден запрос входа по QR</p>
                      <p className="mt-1 text-xs text-slate-400">Код: {pendingPairCode}. Подтверди вход на другом устройстве.</p>
                      <button
                        type="button"
                        onClick={() => void approveQrPairLogin()}
                        className="mt-2 w-full rounded-xl px-3 py-2 text-white"
                        style={accentButtonStyle}
                      >
                        Подтвердить вход
                      </button>
                    </div>
                  )}

                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-slate-200">Устройства в аккаунте</p>
                      <button
                        type="button"
                        onClick={() => void refreshDeviceSessions()}
                        className="rounded-xl px-2 py-1 text-xs"
                        style={accentSurfaceStyle}
                      >
                        Обновить
                      </button>
                    </div>
                    <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                      {deviceSessions.length === 0 && <p className="text-xs text-slate-400">Сессии пока не найдены.</p>}
                      {deviceSessions.map((session) => {
                        const isCurrent = session.id === sessionId;
                        return (
                          <div key={session.id} className="rounded-xl border p-2" style={accentInputStyle}>
                            <p className="text-xs">{session.deviceName}</p>
                            <p className="text-[11px] text-slate-400">
                              Последняя активность: {new Date(session.lastSeenAt).toLocaleString("ru-RU")}
                            </p>
                            {!isCurrent && (
                              <button
                                type="button"
                                onClick={() => void revokeDeviceSession(session.id)}
                                className="mt-1 rounded-lg bg-rose-500/70 px-2 py-1 text-[11px] text-white"
                              >
                                Выбросить устройство
                              </button>
                            )}
                            {isCurrent && <p className="mt-1 text-[11px] text-emerald-300">Текущее устройство</p>}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => void revokeDeviceSession(undefined, true)}
                      className="mt-2 w-full rounded-xl bg-rose-500/80 px-2 py-2 text-xs text-white"
                    >
                      Выбросить все остальные устройства
                    </button>
                    {deviceActionStatus && <p className="mt-1 text-xs text-slate-300">{deviceActionStatus}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => void updateProfileSettings()}
                    className="w-full rounded-xl px-3 py-2 text-white"
                    style={accentButtonStyle}
                  >
                    Сохранить профиль
                  </button>
                  {profileSaveError && <p className="text-xs text-rose-300">{profileSaveError}</p>}
                  {profileSaveStatus && <p className="text-xs text-emerald-300">{profileSaveStatus}</p>}

                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <p className="mb-2 text-slate-300">Klanzy AI</p>
                    <label className="mb-1 block text-slate-400">Gemini API Key</label>
                    <input
                      type="password"
                      value={aiApiKey}
                      onChange={(event) => setAiApiKey(event.target.value)}
                      placeholder="AIza..."
                      className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                      style={accentInputStyle}
                    />
                    <label className="mb-1 mt-3 block text-slate-400">Модель</label>
                    <input
                      value={aiModel}
                      onChange={(event) => setAiModel(event.target.value)}
                      placeholder="gemini-2.5-flash"
                      className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                      style={accentInputStyle}
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Без ключа работает простой офлайн-режим. С ключом подключается реальный Gemini API.
                    </p>
                  </div>
                </>
              )}

              {activeSettingsTab === "admin" && isAdmin && (
                <div className="space-y-3">
                  <form onSubmit={adminSendMessageToAnyChat} className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <p className="mb-2 text-slate-300">Писать в любой чат</p>
                    <select
                      value={adminMessageChatId}
                      onChange={(event) => setAdminMessageChatId(event.target.value)}
                      className="w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                      style={accentInputStyle}
                    >
                      <option value="">Выбери чат</option>
                      {chats.map((chat) => (
                        <option key={chat.id} value={chat.id}>
                          {chat.title}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={adminMessageText}
                      onChange={(event) => setAdminMessageText(event.target.value)}
                      className="mt-2 h-24 w-full rounded-xl border bg-transparent px-3 py-2 outline-none"
                      style={accentInputStyle}
                      placeholder="Текст админ-сообщения"
                    />
                    <button type="submit" className="mt-2 w-full rounded-xl py-2 text-white" style={accentButtonStyle}>
                      Отправить как админ
                    </button>
                  </form>

                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <p className="mb-2 text-slate-300">Выдать бейдж</p>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        value={adminBadgeUser}
                        onChange={(event) => setAdminBadgeUser(event.target.value)}
                        placeholder="@username"
                        className="rounded-xl border bg-transparent px-3 py-2 outline-none"
                        style={accentInputStyle}
                      />
                      <select
                        value={adminBadgeValue}
                        onChange={(event) => setAdminBadgeValue(event.target.value)}
                        className="rounded-xl border bg-transparent px-2 py-2 outline-none"
                        style={accentInputStyle}
                      >
                        <option value="verified">Проверенный</option>
                        <option value="helper">Помощник</option>
                        <option value="developer">Разработчик</option>
                        <option value="vip">VIP</option>
                        <option value="">Без бейджа</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => void setUserBadgeByAdmin()}
                      className="mt-2 w-full rounded-xl py-2 text-white"
                      style={accentButtonStyle}
                    >
                      Применить бейдж
                    </button>
                  </div>

                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <p className="mb-2 text-slate-300">Безопасность</p>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        value={adminSessionUser}
                        onChange={(event) => setAdminSessionUser(event.target.value)}
                        placeholder="@username"
                        className="rounded-xl border bg-transparent px-3 py-2 outline-none"
                        style={accentInputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => void revokeUserSessionsByAdmin()}
                        className="rounded-xl bg-rose-500/80 px-2 py-2 text-xs text-white"
                      >
                        Выгнать
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void clearAllLoginCodesByAdmin()}
                      className="mt-2 w-full rounded-xl px-3 py-2 text-xs text-white"
                      style={accentButtonStyle}
                    >
                      Очистить все коды входа
                    </button>
                  </div>

                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <p className="mb-2 text-slate-300">Пользователи</p>
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {users
                        .filter((user) => normalizeUsername((user.username || "").replace("@", "")) !== CREATOR_USERNAME)
                        .map((user) => {
                          const normalizedUser = normalizeUsername((user.username || "").replace("@", ""));
                          return (
                            <div key={user.id || user.username} className="rounded-xl border p-2" style={accentInputStyle}>
                              <div className="flex items-center gap-2 text-xs">
                                <span>{user.nickname}</span>
                                {renderBadge(user.badge, "sm")}
                              </div>
                              <div className="text-[11px] text-slate-400">{user.username}</div>
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void setUserBanState(normalizedUser, !user.banned)}
                                  className="rounded-lg px-2 py-1 text-[11px] text-white"
                                  style={{ backgroundColor: user.banned ? "#16a34a" : "#ef4444" }}
                                >
                                  {user.banned ? "Разбанить" : "Забанить"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteUserAccountByAdmin(normalizedUser)}
                                  className="rounded-lg bg-rose-500/70 px-2 py-1 text-[11px] text-white"
                                >
                                  Удалить аккаунт
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                    <p className="mb-2 text-slate-300">Каналы и группы</p>
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {chats
                        .filter((chat) => chat.kind === "channel" || chat.kind === "group")
                        .map((chat) => (
                          <div key={chat.id} className="flex items-center justify-between rounded-xl border p-2" style={accentInputStyle}>
                            <div>
                              <p className="text-xs">{chat.title}</p>
                              <p className="text-[11px] text-slate-400">{chat.kind}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteManagedChat(chat.id)}
                              className="rounded-lg bg-rose-500/70 px-2 py-1 text-[11px] text-white"
                            >
                              Удалить
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>

                  {adminActionStatus && <p className="text-xs text-amber-300">{adminActionStatus}</p>}
                </div>
              )}
            </div>
          )}
        </aside>

        <main className={`flex min-h-[500px] flex-col rounded-[2rem] p-4 transition-all duration-500 klanzy-panel-enter ${panelClass}`} style={panelStyle}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: hexToRgba(accent.secondary, 0.35) }}>
            <div>
              {activeChat.kind === "group" || activeChat.kind === "channel" ? (
                <button
                  type="button"
                  onClick={() => setShowChatMenu(true)}
                  className="flex items-center gap-2 rounded-2xl px-2 py-1 text-left"
                  title="Управление группой или каналом"
                >
                  <h2 className="text-xl font-semibold">{activeChat.title}</h2>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                    style={accentChipStyle}
                  >
                    {canManageActiveChat ? "⚙ управление" : "ℹ инфо"}
                  </span>
                </button>
              ) : (
                <h2 className="text-xl font-semibold">{activeChat.title}</h2>
              )}
              <p className="text-xs text-slate-400">
                {activeChat.username ??
                  (activeChat.kind === "group"
                    ? "группа"
                    : activeChat.kind === "channel"
                      ? "канал"
                      : activeChat.kind === "bot"
                        ? "бот"
                        : "Личный диалог")}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {activeChat.kind === "direct" && (
                <button
                  type="button"
                  onClick={toggleBlock}
                  className={`rounded-xl px-3 py-2 text-xs ${
                    isBlocked ? "bg-rose-500 text-white" : "text-indigo-100"
                  }`}
                  style={!isBlocked ? accentSurfaceStyle : undefined}
                >
                  {isBlocked ? "Разблокировать" : "Заблокировать"}
                </button>
              )}

              {activeChat.kind === "channel" && (
                <button
                  type="button"
                  onClick={toggleSubscribe}
                  className={`rounded-xl px-3 py-2 text-xs ${
                    isSubscribed ? "bg-emerald-500/70 text-white" : "text-indigo-100"
                  }`}
                  style={!isSubscribed ? accentSurfaceStyle : undefined}
                >
                  {isSubscribed ? "Подписан" : "Подписаться"}
                </button>
              )}

              <input
                value={messageSearch}
                onChange={(event) => setMessageSearch(event.target.value)}
                placeholder="Поиск сообщений"
                className="h-9 w-36 rounded-xl border bg-transparent px-2.5 py-1.5 text-xs outline-none sm:w-44"
                style={accentInputStyle}
              />
              <button
                type="button"
                onClick={clearActiveChatHistory}
                className="h-9 rounded-xl px-2.5 text-[11px] leading-tight text-white sm:px-3 sm:text-xs"
                style={{ backgroundColor: hexToRgba("#ef4444", 0.65) }}
              >
                <span className="block text-center">
                  Очистить
                  <br />
                  чат
                </span>
              </button>
            </div>
          </div>

          {pinnedMessage && (
            <div className="mb-2 rounded-xl border px-3 py-2 text-xs" style={accentSoftStyle}>
              <p className="text-slate-300">Закреплено</p>
              <p className="truncate">{pinnedMessage.text}</p>
            </div>
          )}

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {filteredMessages.map((message, index) => {
              const mine = isMessageMine(message);
              return (
                <div
                key={message.id}
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm transition-all duration-500 klanzy-message-enter ${
                  mine ? "ml-auto text-white" : ""
                }`}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openMessageActionMenu({
                    chatId: activeChat.id,
                    messageId: message.id,
                    x: event.clientX,
                    y: event.clientY
                  });
                }}
                onTouchStart={(event) => {
                  if (longPressTimerRef.current) {
                    window.clearTimeout(longPressTimerRef.current);
                  }

                  const touch = event.touches[0];
                  longPressTimerRef.current = window.setTimeout(() => {
                    openMessageActionMenu({
                      chatId: activeChat.id,
                      messageId: message.id,
                      x: touch.clientX,
                      y: touch.clientY
                    });
                  }, 460);
                }}
                onTouchEnd={() => {
                  if (longPressTimerRef.current) {
                    window.clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onTouchMove={() => {
                  if (longPressTimerRef.current) {
                    window.clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                style={{
                  ...(mine ? accentMineMessageStyle : accentBubbleStyle),
                  animationDelay: `${Math.min(index, 10) * 35}ms`
                }}
              >
                {!mine && message.senderNickname && (
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-medium opacity-80">
                    <span>{message.senderNickname}</span>
                    {renderBadge(getBadgeForUsername(message.senderUsername), "xs")}
                  </p>
                )}
                <p className="break-words">{message.text}</p>
                {renderAttachment(message, ({ type, url, name }) => setMediaViewer({ type, url, name }))}
                <p className="mt-1 text-[10px] opacity-70">{message.createdAt}</p>
              </div>
              );
            })}
            {filteredMessages.length === 0 && (
              <p className="pt-6 text-center text-sm text-slate-400">Сообщения по запросу не найдены.</p>
            )}
            {activeChat.id === GEMINI_CHAT_ID && isAiResponding && (
              <div className="max-w-[75%] rounded-2xl px-4 py-2 text-sm" style={accentBubbleStyle}>
                <p>Gemini печатает...</p>
              </div>
            )}
          </div>

          <div className="mt-3 border-t pt-3" style={{ borderColor: hexToRgba(accent.secondary, 0.35) }}>
            {isBlocked && (
              <p className="mb-2 text-xs text-rose-300">Пользователь заблокирован. Отправка отключена.</p>
            )}
            {isBlockedByOther && (
              <p className="mb-2 text-xs text-rose-300">Этот человек вас заблокировал.</p>
            )}
            {isChannel && !isSubscribed && (
              <p className="mb-2 text-xs text-amber-300">Подпишись на канал, чтобы писать сообщения.</p>
            )}
            {messageReplyTarget && (
              <div className="mb-2 flex items-center justify-between rounded-xl border px-3 py-2 text-xs" style={accentSoftStyle}>
                <p className="truncate">Ответ: {messageReplyTarget.text}</p>
                <button type="button" onClick={() => setMessageReplyTarget(null)} className="rounded-lg px-2 py-1" style={accentInputStyle}>
                  Отмена
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu((prev) => !prev)}
                  style={accentSurfaceStyle}
                  className="rounded-xl px-3 py-2 text-sm"
                >
                  +
                </button>
                {showAttachmentMenu && (
                  <div
                    className="absolute bottom-12 left-0 z-20 w-64 rounded-2xl border p-2.5 text-xs shadow-2xl klanzy-popover-enter"
                    style={{
                      ...panelStyle,
                      borderColor: hexToRgba(accent.secondary, theme === "dark" ? 0.55 : 0.4),
                      background:
                        theme === "dark"
                          ? `linear-gradient(165deg, ${hexToRgba(accent.primary, 0.35)}, rgba(2, 6, 23, 0.96) 55%)`
                          : `linear-gradient(165deg, ${hexToRgba(accent.primary, 0.2)}, rgba(255, 255, 255, 0.98) 55%)`
                    }}
                  >
                    <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">Вложения</p>
                    <div className="space-y-1.5">
                    {attachmentOptions.map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => onAttachmentSelect(item.kind)}
                        className="group flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition hover:scale-[1.01]"
                        style={{
                          ...accentSurfaceStyle,
                          borderColor: hexToRgba(accent.primary, 0.35)
                        }}
                      >
                        <span
                          className="inline-flex min-w-12 justify-center rounded-lg px-2 py-1 text-[10px] font-semibold tracking-wide"
                          style={{
                            backgroundColor: hexToRgba(accent.secondary, 0.2),
                            color: theme === "dark" ? accent.text : accent.primary
                          }}
                        >
                          {item.short}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-none">{item.kind}</span>
                          <span className="mt-1 block truncate text-[11px] text-slate-400">{item.hint}</span>
                        </span>
                      </button>
                    ))}
                    </div>
                  </div>
                )}
                <input ref={attachmentInputRef} type="file" className="hidden" onChange={onAttachmentUpload} />
              </div>

              <input
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    sendMessage();
                  }
                }}
                placeholder="Напиши сообщение"
                disabled={isBlocked || isBlockedByOther || (isChannel && !isSubscribed)}
                className="flex-1 rounded-xl border bg-transparent px-3 py-2 outline-none disabled:opacity-50"
                style={accentInputStyle}
              />
              <button
                type="button"
                onClick={sendMessage}
                style={accentButtonStyle}
                className="h-9 w-9 shrink-0 rounded-lg text-white"
                aria-label="Отправить"
                title="Отправить"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="mx-auto h-4 w-4" aria-hidden="true">
                  <path d="M21 3 3.5 10.3a1 1 0 0 0 .1 1.9l6.8 2.3 2.3 6.8a1 1 0 0 0 1.9.1L21 3Z" />
                </svg>
              </button>
            </div>
          </div>
        </main>
      </div>

      {mediaViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 klanzy-overlay-enter">
          <button
            type="button"
            onClick={() => setMediaViewer(null)}
            className="absolute right-4 top-4 rounded-xl bg-white/10 px-3 py-2 text-sm text-white"
          >
            Закрыть
          </button>
          <div className="h-full w-full max-w-6xl klanzy-media-enter">
            {mediaViewer.type === "Фото" ? (
              <img src={mediaViewer.url} alt={mediaViewer.name} className="h-full w-full object-contain" />
            ) : (
              <video src={mediaViewer.url} controls autoPlay className="h-full w-full object-contain" />
            )}
          </div>
        </div>
      )}

      {messageActionMenu && (
        <>
          <button
            type="button"
            aria-label="Закрыть меню сообщения"
            onClick={closeMessageActionMenu}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          />
          <div
            className="fixed z-50 w-52 rounded-xl border p-1.5 shadow-2xl klanzy-popover-enter"
            style={{
              ...messageActionMenuStyle,
              left: Math.min(messageActionMenu.x, window.innerWidth - 212),
              top: Math.min(messageActionMenu.y, window.innerHeight - 260)
            }}
          >
            <button
              type="button"
              onClick={() => void handleMessageAction("reply")}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              Ответить
            </button>
            <button
              type="button"
              onClick={() => void handleMessageAction("copy")}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              Скопировать
            </button>
            <button
              type="button"
              onClick={() => void handleMessageAction("pin")}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              Закрепить
            </button>
            <button
              type="button"
              onClick={() => void handleMessageAction("forward")}
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              Переслать
            </button>
            {currentUsername === CREATOR_USERNAME && (
              <button
                type="button"
                onClick={() => void handleMessageAction("gift")}
                className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
              >
                Отправить подарок
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleMessageAction("delete")}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/20"
            >
              Удалить
            </button>
          </div>
        </>
      )}

      {showChatMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
          onClick={() => setShowChatMenu(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border p-4 klanzy-popover-enter"
            style={{
              backgroundColor: "var(--md-sys-color-surface-container-high)",
              borderColor: "var(--md-sys-color-outline-variant)",
              color: "var(--md-sys-color-on-surface)"
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-medium">{activeChat.title}</h3>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={accentChipStyle}>
                    {activeChat.kind === "channel" ? "канал" : "группа"}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400">
                  {activeChat.username ?? "без username"} · создатель @
                  {normalizeUsername((activeChat.ownerUsername || "").replace("@", ""))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChatMenu(false)}
                className="rounded-full border px-3 py-1 text-xs"
                style={accentInputStyle}
              >
                Закрыть
              </button>
            </div>

            {canManageActiveChat ? (
              <div className="space-y-3">
                <div className="rounded-2xl border p-3" style={accentSoftStyle}>
                  <p className="mb-2 text-xs text-slate-300">
                    Админы {activeChat.kind === "channel" ? "канала" : "группы"}
                  </p>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {activeChatAdmins.length === 0 && (
                      <span className="text-xs text-slate-400">Пока нет назначенных админов.</span>
                    )}
                    {activeChatAdmins.map((username) => (
                      <span key={username} className="rounded-full border px-2 py-1 text-[11px]" style={accentInputStyle}>
                        @{username.replace(/^@/, "")}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <select
                      value={chatAdminTargetUsername}
                      onChange={(event) => setChatAdminTargetUsername(event.target.value)}
                      className="rounded-xl border bg-transparent px-3 py-2 text-xs outline-none"
                      style={accentInputStyle}
                    >
                      <option value="">Выбери пользователя</option>
                      {managedChatUsers.map((user) => (
                        <option
                          key={user.id || user.username}
                          value={normalizeUsername((user.username || "").replace("@", ""))}
                        >
                          {(user.nickname || user.username) + " " + (user.username || "")}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void setActiveChatAdminState(chatAdminTargetUsername, true)}
                      className="rounded-xl px-3 py-2 text-xs"
                      style={accentButtonStyle}
                    >
                      Назначить
                    </button>
                    <button
                      type="button"
                      onClick={() => void setActiveChatAdminState(chatAdminTargetUsername, false)}
                      className="rounded-xl px-3 py-2 text-xs"
                      style={accentSurfaceStyle}
                    >
                      Снять
                    </button>
                  </div>
                  {chatManageStatus && <p className="mt-2 text-xs text-slate-300">{chatManageStatus}</p>}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowChatMenu(false);
                    void deleteActiveGroupOrChannel();
                  }}
                  className="w-full rounded-xl bg-rose-500/80 px-3 py-2 text-xs text-white"
                >
                  Удалить {activeChat.kind === "channel" ? "канал" : "группу"}
                </button>
              </div>
            ) : (
              <p className="rounded-2xl border p-3 text-xs text-slate-300" style={accentSoftStyle}>
                Управление админами доступно только создателю {activeChat.kind === "channel" ? "канала" : "группы"}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [skin, setSkin] = useState<{ theme: Theme; accentTheme: AccentTheme }>(() => ({
    theme: readStoredTheme(),
    accentTheme: readStoredAccent()
  }));

  useEffect(() => {
    const handleSkin = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: Theme; accentTheme?: AccentTheme }>).detail;
      if (!detail?.theme || !detail?.accentTheme) {
        return;
      }
      setSkin({ theme: detail.theme, accentTheme: detail.accentTheme });
    };
    window.addEventListener("klanzy:skin", handleSkin);
    return () => window.removeEventListener("klanzy:skin", handleSkin);
  }, []);

  return (
    <M3eTheme variant="tonal-spot" motion="expressive" scheme={skin.theme} color={M3_ACCENT_SEEDS[skin.accentTheme]}>
      <AppShell />
    </M3eTheme>
  );
}
