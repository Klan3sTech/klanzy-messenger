import type { ChatItem, Message, UserProfile } from "./types";

const now = Date.now();
const MIN = 60_000;

const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const uid = (prefix = "id") => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const msg = (
  id: string,
  sender: "me" | "other",
  text: string,
  minutesAgo: number,
  extra: Partial<Message> = {},
): Message => {
  const ts = now - minutesAgo * MIN;
  return {
    id,
    sender,
    text,
    ts,
    createdAt: hhmm(ts),
    ...extra,
  };
};

export const demoUsers: UserProfile[] = [
  {
    id: "u-klan3s",
    nickname: "Klan",
    username: "@klan3s",
    email: "klan@klan.xyz",
    badge: "creator",
    createdAt: now - 90 * 24 * 60 * MIN,
  },
  {
    id: "u-nova",
    nickname: "Nova",
    username: "@nova",
    email: "nova@minx.app",
    badge: "verified",
    createdAt: now - 60 * 24 * 60 * MIN,
  },
  {
    id: "u-mira",
    nickname: "Mira",
    username: "@mira",
    email: "mira@minx.app",
    createdAt: now - 40 * 24 * 60 * MIN,
  },
  {
    id: "u-darko",
    nickname: "Darko",
    username: "@darko",
    email: "darko@minx.app",
    createdAt: now - 30 * 24 * 60 * MIN,
  },
  {
    id: "u-support",
    nickname: "Minx Бот",
    username: "@MinxSupport",
    badge: "bot",
    createdAt: now - 88 * 24 * 60 * MIN,
  },
  {
    id: "u-gemini",
    nickname: "Gemini",
    username: "@Gemini",
    badge: "bot",
    createdAt: now - 70 * 24 * 60 * MIN,
  },
];

export const demoChats: ChatItem[] = [
  {
    id: "minx-community",
    title: "Общий чат Minx",
    username: "@MinxCommunity",
    kind: "group",
    visibility: "open",
    subscribed: true,
    ownerUsername: "@klan3s",
    pinned: true,
    createdAt: now - 90 * 24 * 60 * MIN,
    messages: [
      msg("m-1", "other", "Это общий чат Minx. Здесь можно писать всем, кто сейчас онлайн 💬", 2600, {
        senderUsername: "@MinxSupport",
        senderNickname: "Minx Бот",
        reactions: { "👍": ["@nova", "@mira"], "🔥": ["@darko"] },
      }),
      msg("m-2", "other", "Привет всем! Кто уже посмотрел новый Material 3 Expressive?", 180, {
        senderUsername: "@nova",
        senderNickname: "Nova",
      }),
      msg("m-3", "other", "Выглядит как будущее. Кнопки пружинят 😄", 150, {
        senderUsername: "@mira",
        senderNickname: "Mira",
        reactions: { "💩": ["@klan3s"] },
      }),
      msg("m-4", "me", "Я как раз переписываю фронт Minx на M3E — компоненты настоящие, из @m3e/web.", 90, {
        senderUsername: "@klan3s",
        senderNickname: "Klan",
        reactions: { "🔥": ["@nova", "@mira", "@darko"] },
      }),
      msg("m-5", "other", "Покажешь скрин?", 40, {
        senderUsername: "@darko",
        senderNickname: "Darko",
      }),
    ],
  },
  {
    id: "minx-news",
    title: "Minx News",
    username: "@MinxNews",
    kind: "channel",
    visibility: "open",
    subscribed: true,
    ownerUsername: "@klan3s",
    createdAt: now - 80 * 24 * 60 * MIN,
    messages: [
      msg("n-1", "other", "📣 Minx переехал на Material 3 Expressive.\n\nЧто изменилось:\n• новая навигация и app bar\n• пружинные анимации (motion=\"expressive\")\n• тональные поверхности вместо плоских блоков\n• адаптив: rail → bottom bar", 900, {
        senderUsername: "@klan3s",
        senderNickname: "Klan",
        reactions: { "👍": ["@nova", "@mira", "@darko"], "🎉": ["@mira"] },
      }),
      msg("n-2", "other", "Тема акцента теперь меняется в настройках — 8 палитр.", 300, {
        senderUsername: "@klan3s",
        senderNickname: "Klan",
      }),
    ],
  },
  {
    id: "memes",
    title: "Какашки & Мемы",
    username: "@MinxMemes",
    kind: "channel",
    visibility: "open",
    subscribed: true,
    ownerUsername: "@mira",
    createdAt: now - 40 * 24 * 60 * MIN,
    messages: [
      msg("mm-1", "other", "Когда сверстал 200 экранов и наконец нажал «Задеплоить» 😵", 700, {
        senderUsername: "@mira",
        senderNickname: "Mira",
        attachment: "Фото",
        attachmentName: "deploy-mood.png",
        reactions: { "💩": ["@klan3s", "@nova"], "😂": ["@darko"] },
      }),
    ],
  },
  {
    id: "minx-team",
    title: "Minx Team",
    username: "@MinxTeam",
    kind: "group",
    visibility: "private",
    subscribed: true,
    ownerUsername: "@klan3s",
    createdAt: now - 60 * 24 * 60 * MIN,
    messages: [
      msg("t-1", "other", "Ребят, обновила композер: теперь «пружинит» при фокусе.", 320, {
        senderUsername: "@nova",
        senderNickname: "Nova",
      }),
      msg("t-2", "me", "Огонь. Давайте так же сделаем админку 👍", 300, {
        senderUsername: "@klan3s",
        senderNickname: "Klan",
        reactions: { "👍": ["@nova"] },
      }),
      msg("t-3", "other", "Какашки-реакции оставляем? 😄", 120, {
        senderUsername: "@mira",
        senderNickname: "Mira",
      }),
      msg("t-4", "other", "Оставляем. Это наша киллер-фича 💩", 95, {
        senderUsername: "@darko",
        senderNickname: "Darko",
        reactions: { "💩": ["@nova", "@mira"] },
      }),
    ],
  },
  {
    id: "gemini-support",
    title: "Gemini",
    username: "@Gemini",
    kind: "bot",
    visibility: "open",
    subscribed: true,
    ownerUsername: "@Gemini",
    createdAt: now - 70 * 24 * 60 * MIN,
    messages: [
      msg("g-1", "other", "Привет! Я Gemini-помощник внутри Minx. Спроси что угодно — подскажу по Material 3, коду и дизайну.", 500, {
        senderUsername: "@Gemini",
        senderNickname: "Gemini",
      }),
    ],
  },
  {
    id: "support",
    title: "Minx Бот",
    username: "@MinxSupport",
    kind: "bot",
    visibility: "open",
    subscribed: true,
    ownerUsername: "@MinxSupport",
    createdAt: now - 88 * 24 * 60 * MIN,
    messages: [
      msg("s-1", "other", "Я Minx Бот 🤖\n\nКоманды:\n/help — что я умею\n/stats — статистика аккаунта\n/theme — как менять тему\n/admin — если ты @klan3s", 1200, {
        senderUsername: "@MinxSupport",
        senderNickname: "Minx Бот",
      }),
    ],
  },
  {
    id: "dm-nova",
    title: "Nova",
    username: "@nova",
    kind: "direct",
    visibility: "private",
    subscribed: true,
    createdAt: now - 60 * 24 * 60 * MIN,
    messages: [
      msg("d-1", "other", "Привет! Скинь финальный палитр, я в Figma зафиксирую 🎨", 240, {
        senderUsername: "@nova",
        senderNickname: "Nova",
      }),
      msg("d-2", "me", "Привет! Основа — #6750A4, акцент меняется в настройках, контейнеры тональные.", 230, {
        senderUsername: "@klan3s",
        senderNickname: "Klan",
      }),
      msg("d-3", "other", "Идеально, спасибо 🦉", 60, {
        senderUsername: "@nova",
        senderNickname: "Nova",
      }),
    ],
  },
  {
    id: "dm-darko",
    title: "Darko",
    username: "@darko",
    kind: "direct",
    visibility: "private",
    subscribed: true,
    createdAt: now - 28 * 24 * 60 * MIN,
    messages: [
      msg("dd-1", "other", "Бэкенд на SQLite поднял, WS работает ✅", 300, {
        senderUsername: "@darko",
        senderNickname: "Darko",
      }),
    ],
  },
];

/** Ответы ботов в демо-режиме (и как fallback, если сервер молчит). */
export function botReply(botUsername: string, text: string): string {
  const t = text.trim().toLowerCase();
  const bot = botUsername.replace("@", "").toLowerCase();

  if (bot === "geminisupport" || bot === "gemini") {
    if (t.includes("m3e") || t.includes("material")) {
      return "M3E — это веб-компоненты Material 3 Expressive: <m3e-button>, <m3e-fab>, <m3e-nav-rail>. Тема задаётся через <m3e-theme color=\"#6750A4\" motion=\"expressive\">.";
    }
    if (t.includes("код") || t.includes("code")) {
      return "Скинь фрагмент — разберу. Для M3E обычно достаточно заменить обёртки на <m3e-card> и <m3e-list>.";
    }
    return "Интересно! Могу помочь с Material 3, дизайн-токенами и кодом. Уточни вопрос 👀";
  }

  if (t.startsWith("/help")) {
    return "Команды Minx Бота:\n/help — список команд\n/stats — статистика аккаунта\n/theme — про темы и акценты\n/admin — админ-панель (только @klan3s)\n/about — что такое Minx";
  }
  if (t.startsWith("/stats")) {
    return "Статистика Minx 📊\n• чатов: 8\n• сообщений: 18\n• участников: 6\n• режим: Material 3 Expressive";
  }
  if (t.startsWith("/theme")) {
    return "Тема: Настройки → Оформление. Доступны светлая, тёмная и системная схемы, плюс 8 акцентных палитр.";
  }
  if (t.startsWith("/admin")) {
    return "Админ-панель доступна только создателю @klan3s: Настройки → Админ.";
  }
  if (t.startsWith("/about")) {
    return "Minx — мессенджер с каналами, группами и ботами. Интерфейс собран на M3E (Material 3 Expressive).";
  }
  if (/привет|hello|hi|салют|здаров/.test(t)) {
    return "Привет! 👋 Напиши /help — покажу, что умею.";
  }
  if (/какаш|💩/.test(t)) {
    return "💩 — уважаемая реакция в Minx. Одобряю.";
  }
  const variants = [
    "Принял 🦉",
    "Записал в блокнотик 📝",
    "Звучит как план 🚀",
    "Понял тебя. Кстати, попробуй /stats 👀",
    "Интересно! Расскажи подробнее?",
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}
