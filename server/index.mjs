import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { WebSocketServer } from "ws";
import nodemailer from "nodemailer";

const PORT = Number(process.env.PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "data");
const DB_PATH = join(DATA_DIR, "klanzy.sqlite");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

const normalizeUsername = (value = "") => {
  const prepared = String(value).toLowerCase().replace(/[^a-z0-9_]/g, "");
  return prepared ? `@${prepared}` : "";
};

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const CREATOR_USERNAME = "@klan3s";
const SESSION_TTL_MS = 45 * 24 * 60 * 60 * 1000;
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM || SMTP_FROM || "onboarding@resend.dev";
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "Klanzy";

const mailTransport =
  SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      })
    : null;

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `klanzy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const baseChats = [
  {
    id: "klanzy-community",
    title: "Общий чат Klanzy",
    username: "@KlanzyCommunity",
    kind: "group",
    visibility: "open",
    ownerUsername: "klan3s",
    subscribed: 1,
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
    subscribed: 1,
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
    subscribed: 1,
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
    subscribed: 1,
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
  }
];

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    avatar TEXT,
    badge TEXT,
    banned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    username TEXT UNIQUE,
    kind TEXT NOT NULL,
    visibility TEXT NOT NULL,
    subscribed INTEGER NOT NULL DEFAULT 0,
    owner_username TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_admins (
    chat_id TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (chat_id, username),
    FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chat_admins_username ON chat_admins(username);

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    sender_id TEXT,
    sender_username TEXT,
    sender_nickname TEXT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attachment TEXT,
    attachment_name TEXT,
    attachment_url TEXT,
    attachment_mime TEXT,
    ts INTEGER NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat_id_ts ON messages(chat_id, ts);

  CREATE TABLE IF NOT EXISTS login_codes (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blocks (
    blocker_username TEXT NOT NULL,
    blocked_username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(blocker_username, blocked_username)
  );

  CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_username);

  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    device_name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    last_seen_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_user_sessions_username ON user_sessions(username);

  CREATE TABLE IF NOT EXISTS email_outbox (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS qr_login_pairs (
    pair_code TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    requester_device_name TEXT NOT NULL,
    status TEXT NOT NULL,
    approved_user_id TEXT,
    approved_username TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    consumed_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_qr_pairs_requester ON qr_login_pairs(requester_id, created_at DESC);
`);

const runMigration = (sql) => {
  try {
    db.exec(sql);
  } catch {
    // Ignore already-applied schema migrations.
  }
};

runMigration("ALTER TABLE users ADD COLUMN email TEXT");
runMigration("ALTER TABLE users ADD COLUMN badge TEXT");
runMigration("ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0");
runMigration("ALTER TABLE chats ADD COLUMN owner_username TEXT");
runMigration("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND email <> ''");
db.prepare("UPDATE users SET badge = 'creator' WHERE username = ?").run(CREATOR_USERNAME);
db.prepare("UPDATE users SET badge = 'creator' WHERE badge = 'Создатель'").run();

const upsertChatStmt = db.prepare(`
  INSERT INTO chats (id, title, username, kind, visibility, subscribed, owner_username, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    username = excluded.username,
    kind = excluded.kind,
    visibility = excluded.visibility,
    subscribed = excluded.subscribed,
    owner_username = COALESCE(chats.owner_username, excluded.owner_username)
`);

const insertMessageStmt = db.prepare(`
  INSERT OR IGNORE INTO messages (
    id,
    chat_id,
    sender,
    sender_id,
    sender_username,
    sender_nickname,
    text,
    created_at,
    attachment,
    attachment_name,
    attachment_url,
    attachment_mime,
    ts
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const ensureBaseData = () => {
  const count = Number(db.prepare("SELECT COUNT(*) AS count FROM chats").get().count || 0);
  if (count > 0) {
    return;
  }

  db.exec("BEGIN");
  try {
    for (const chat of baseChats) {
      upsertChatStmt.run(
        chat.id,
        chat.title,
        chat.username ?? null,
        chat.kind,
        chat.visibility,
        chat.subscribed ? 1 : 0,
        chat.ownerUsername ?? null,
        Date.now()
      );

      for (const message of chat.messages || []) {
        insertMessageStmt.run(
          message.id,
          chat.id,
          message.sender,
          null,
          message.senderUsername ?? null,
          message.senderNickname ?? null,
          message.text ?? "",
          message.createdAt ?? "",
          null,
          null,
          null,
          null,
          Date.now()
        );
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

ensureBaseData();

const mapMessageRow = (row) => ({
  id: row.id,
  sender: row.sender,
  senderId: row.sender_id || undefined,
  senderUsername: row.sender_username || undefined,
  senderNickname: row.sender_nickname || undefined,
  text: row.text,
  createdAt: row.created_at,
  attachment: row.attachment || undefined,
  attachmentName: row.attachment_name || undefined,
  attachmentUrl: row.attachment_url || undefined,
  attachmentMime: row.attachment_mime || undefined
});

const mapChatRow = (row) => ({
  id: row.id,
  title: row.title,
  username: row.username || undefined,
  kind: row.kind,
  visibility: row.visibility,
  subscribed: Boolean(row.subscribed),
  ownerUsername: row.owner_username || undefined,
  messages: []
});

const getAllUsers = () =>
  db
    .prepare("SELECT id, nickname, username, email, avatar, badge, banned FROM users ORDER BY created_at ASC")
    .all()
    .map((row) => ({
      id: row.id,
      nickname: row.nickname,
      username: row.username,
      email: row.email || "",
      avatar: row.avatar || undefined,
      badge: row.badge || undefined,
      banned: Boolean(row.banned)
    }));

const getChatAdmins = () =>
  db
    .prepare("SELECT chat_id, username FROM chat_admins ORDER BY created_at ASC")
    .all()
    .map((row) => ({
      chatId: row.chat_id,
      username: row.username
    }));

const getUserSessions = (username) =>
  db
    .prepare("SELECT id, device_name, last_seen_at, created_at FROM user_sessions WHERE username = ? ORDER BY created_at DESC")
    .all(username)
    .map((row) => ({
      id: row.id,
      deviceName: row.device_name,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at
    }));

const createUserSession = ({ userId, username, deviceName = "Unknown device" }) => {
  const id = createId();
  const token = createId();
  const now = Date.now();
  db.prepare(
    "INSERT INTO user_sessions (id, user_id, username, device_name, token, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, userId, username, String(deviceName).slice(0, 120), token, now, now);
  return { id, token, createdAt: now, deviceName };
};

const hasChatAdminRights = (chatId, actorUsername) => {
  if (!chatId || !actorUsername) {
    return false;
  }

  /* Управлять группой или каналом может только тот, кто их создал. */
  const chatRow = db.prepare("SELECT owner_username FROM chats WHERE id = ? LIMIT 1").get(chatId);
  if (!chatRow) {
    return false;
  }

  return (
    Boolean(chatRow.owner_username) &&
    normalizeUsername(String(chatRow.owner_username).replace("@", "")) === actorUsername
  );
};

const mailProviderName = () => {
  if (RESEND_API_KEY) {
    return "resend";
  }
  if (BREVO_API_KEY) {
    return "brevo";
  }
  if (mailTransport) {
    return "smtp";
  }
  return "";
};

/* HTTP-API почты: работает там, где SMTP-порты закрыты (например, Render free) */
const sendMailOverHttp = async ({ to, subject, text }) => {
  if (RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `${MAIL_FROM_NAME} <${MAIL_FROM_ADDRESS}>`,
        to: [to],
        subject,
        text
      })
    });
    if (!response.ok) {
      throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    return true;
  }

  if (BREVO_API_KEY) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sender: { email: MAIL_FROM_ADDRESS, name: MAIL_FROM_NAME },
        to: [{ email: to }],
        subject,
        textContent: text
      })
    });
    if (!response.ok) {
      throw new Error(`Brevo ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    return true;
  }

  return false;
};

const queueLoginCodeEmail = async ({ email, username, code, expiresInSec }) => {
  if (!email) {
    return false;
  }

  const minutes = Math.floor(expiresInSec / 60);
  const subject = "Klanzy: код для входа";
  const body = `Ваш код входа в Klanzy: ${code}. Username: ${username}. Код действует ${minutes} минут.`;

  db.prepare("INSERT INTO email_outbox (id, email, subject, body, created_at) VALUES (?, ?, ?, ?, ?)").run(
    createId(),
    email,
    subject,
    body,
    Date.now()
  );

  try {
    if (RESEND_API_KEY || BREVO_API_KEY) {
      await sendMailOverHttp({ to: email, subject, text: body });
      console.log(`[mail:sent:${mailProviderName()}] To: ${email} | User: ${username}`);
      return true;
    }

    if (mailTransport) {
      await mailTransport.sendMail({ from: SMTP_FROM, to: email, subject, text: body });
      console.log(`[mail:sent:smtp] To: ${email} | User: ${username}`);
      return true;
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error(`[mail:error] ${details}`);
  }

  /* Почта не настроена — код выводим в лог и отдаём в ответе API,
     чтобы вход можно было завершить на экране. */
  console.log(`[mail:mock] To: ${email} | ${subject} | Code: ${code} | User: ${username} | TTL: ${expiresInSec}s`);
  return false;
};

const getAllBlocks = () =>
  db.prepare("SELECT blocker_username, blocked_username FROM blocks ORDER BY created_at DESC").all().map((row) => ({
    blockerUsername: row.blocker_username,
    blockedUsername: row.blocked_username
  }));

const isUserBanned = (username = "") => {
  const normalized = normalizeUsername(username.replace("@", ""));
  if (!normalized) {
    return false;
  }
  const row = db.prepare("SELECT banned FROM users WHERE username = ? LIMIT 1").get(normalized);
  return Boolean(row?.banned);
};

const createLoginCode = () => String(Math.floor(100000 + Math.random() * 900000));
const createPairCode = () => createLoginCode();

const getAllChats = () => {
  const chats = db
    .prepare("SELECT id, title, username, kind, visibility, subscribed, owner_username FROM chats ORDER BY created_at DESC")
    .all()
    .map(mapChatRow);

  const messageRows = db
    .prepare(
      "SELECT id, chat_id, sender, sender_id, sender_username, sender_nickname, text, created_at, attachment, attachment_name, attachment_url, attachment_mime FROM messages ORDER BY ts ASC"
    )
    .all();

  const messageByChat = new Map();
  for (const row of messageRows) {
    const next = messageByChat.get(row.chat_id) || [];
    next.push(mapMessageRow(row));
    messageByChat.set(row.chat_id, next);
  }

  return chats.map((chat) => ({
    ...chat,
    messages: messageByChat.get(chat.id) || []
  }));
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });

const wss = new WebSocketServer({ noServer: true });
const clients = new Map();

const broadcast = (payload) => {
  const serialized = JSON.stringify(payload);
  for (const socket of clients.values()) {
    if (socket.readyState === 1) {
      socket.send(serialized);
    }
  }
};

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const usernameParam = normalizeUsername((url.searchParams.get("username") || "").replace("@", ""));
    /* Группы и каналы отдаём только их создателю. */
    const chatsForUser = getAllChats().filter((chat) => {
      const owner = normalizeUsername(String(chat.ownerUsername || "").replace("@", ""));
      const participant = normalizeUsername(String(chat.username || "").replace("@", ""));
      if (chat.kind === "group" || chat.kind === "channel") {
        return Boolean(owner) && owner === usernameParam;
      }
      if (chat.kind === "direct") {
        if (!owner && !participant) {
          return true;
        }
        return owner === usernameParam || participant === usernameParam;
      }
      return true;
    });
    sendJson(res, 200, {
      users: getAllUsers(),
      chats: chatsForUser,
      blocks: getAllBlocks(),
      chatAdmins: getChatAdmins(),
      sessions: usernameParam ? getUserSessions(usernameParam) : []
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    const query = (url.searchParams.get("q") || "").toLowerCase();
    const users = getAllUsers();
    const filtered = query
      ? users.filter((user) => `${user.nickname || ""} ${user.username || ""}`.toLowerCase().includes(query))
      : users;
    sendJson(res, 200, { users: filtered });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    try {
      const payload = await readBody(req);
      const profile = payload?.profile || {};
      const clientId = payload?.clientId;
      const normalizedUsername = normalizeUsername(profile.username || "");
      const nickname = String(profile.nickname || "").trim();
      const email = normalizeEmail(profile.email || "");
      const deviceName = String(payload?.deviceName || "Unknown device");

      if (!nickname || !normalizedUsername || !email || !email.includes("@")) {
        sendJson(res, 400, { error: "Invalid profile" });
        return;
      }

      const takenByUser = db.prepare("SELECT 1 FROM users WHERE username = ? LIMIT 1").get(normalizedUsername);
      const takenByChat = db.prepare("SELECT 1 FROM chats WHERE username = ? LIMIT 1").get(normalizedUsername);
      const takenEmail = db.prepare("SELECT 1 FROM users WHERE email = ? LIMIT 1").get(email);

      if (takenByUser || takenByChat || takenEmail) {
        sendJson(res, 409, { error: "Username taken" });
        return;
      }

      const badge = normalizedUsername === CREATOR_USERNAME ? "creator" : null;
      const userId = profile.id || createId();

      db.prepare("INSERT INTO users (id, nickname, username, email, avatar, badge, banned, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)").run(
        userId,
        nickname,
        normalizedUsername,
        email,
        profile.avatar ?? null,
        badge,
        Date.now()
      );

      const session = createUserSession({
        userId,
        username: normalizedUsername,
        deviceName
      });

      const users = getAllUsers();
      broadcast({ type: "users:update", users, clientId });
      sendJson(res, 200, {
        ok: true,
        users,
        session: {
          id: session.id,
          token: session.token,
          deviceName: session.deviceName,
          createdAt: session.createdAt
        }
      });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/profile/update") {
    try {
      const payload = await readBody(req);
      const profile = payload?.profile || {};
      const clientId = payload?.clientId;
      const profileId = String(profile.id || "");
      const nickname = String(profile.nickname || "").trim();
      const normalizedUsername = normalizeUsername(profile.username || "");
      const email = normalizeEmail(profile.email || "");

      if (!profileId || !nickname || !normalizedUsername || !email || !email.includes("@")) {
        sendJson(res, 400, { error: "Invalid profile" });
        return;
      }

      const user = db.prepare("SELECT id, banned, badge FROM users WHERE id = ? LIMIT 1").get(profileId);
      if (!user) {
        sendJson(res, 404, { error: "User not found" });
        return;
      }

      if (user.banned) {
        sendJson(res, 403, { error: "User banned" });
        return;
      }

      const takenByUser = db
        .prepare("SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1")
        .get(normalizedUsername, profileId);
      const takenByChat = db.prepare("SELECT id FROM chats WHERE username = ? LIMIT 1").get(normalizedUsername);
      const takenEmail = db.prepare("SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1").get(email, profileId);

      if (takenByUser || takenByChat || takenEmail) {
        sendJson(res, 409, { error: "Username or email taken" });
        return;
      }

      const badge = normalizedUsername === CREATOR_USERNAME ? "creator" : user.badge || null;
      db.prepare("UPDATE users SET nickname = ?, username = ?, email = ?, avatar = ?, badge = ? WHERE id = ?").run(
        nickname,
        normalizedUsername,
        email,
        profile.avatar ?? null,
        badge,
        profileId
      );

      const users = getAllUsers();
      broadcast({ type: "users:update", users, clientId });
      sendJson(res, 200, {
        ok: true,
        users,
        profile: {
          id: profileId,
          nickname,
          username: normalizedUsername,
          email,
          avatar: profile.avatar ?? undefined,
          badge: badge ?? undefined,
          banned: false
        }
      });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/login/code/request") {
    try {
      const payload = await readBody(req);
      const username = normalizeUsername(payload?.username || "");
      const revealCode = Boolean(payload?.revealCode);
      if (!username) {
        sendJson(res, 400, { error: "Invalid username" });
        return;
      }

      const user = db
        .prepare("SELECT id, username, email, banned FROM users WHERE username = ? LIMIT 1")
        .get(username);
      if (!user) {
        sendJson(res, 404, { error: "User not found" });
        return;
      }

      if (user.banned) {
        sendJson(res, 403, { error: "User banned" });
        return;
      }

      const code = createLoginCode();
      const expiresAt = Date.now() + 10 * 60 * 1000;
      db.prepare("DELETE FROM login_codes WHERE username = ?").run(username);
      db.prepare("INSERT INTO login_codes (code, user_id, username, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(
        code,
        user.id,
        username,
        expiresAt,
        Date.now()
      );

      const sentToEmail = await queueLoginCodeEmail({
        email: user.email || "",
        username,
        code,
        expiresInSec: 600
      });

      sendJson(res, 200, {
        ok: true,
        code: revealCode ? code : undefined,
        expiresInSec: 600,
        sentToEmail,
        maskedEmail: user.email ? user.email.replace(/(^.).+(@.*$)/, "$1***$2") : ""
      });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/login/email/request") {
    try {
      const payload = await readBody(req);
      const email = String(payload?.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        sendJson(res, 400, { error: "Invalid email" });
        return;
      }

      const user = db
        .prepare("SELECT id, username, email, banned FROM users WHERE LOWER(email) = ? LIMIT 1")
        .get(email);

      if (!user) {
        sendJson(res, 404, { error: "Email not found" });
        return;
      }

      if (user.banned) {
        sendJson(res, 403, { error: "User banned" });
        return;
      }

      const username = normalizeUsername(String(user.username || "").replace("@", ""));
      const code = createLoginCode();
      const expiresAt = Date.now() + 10 * 60 * 1000;
      db.prepare("DELETE FROM login_codes WHERE username = ?").run(username);
      db.prepare("INSERT INTO login_codes (code, user_id, username, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(
        code,
        user.id,
        username,
        expiresAt,
        Date.now()
      );

      const emailSent = await queueLoginCodeEmail({
        email: user.email || email,
        username,
        code,
        expiresInSec: 600
      });

      sendJson(res, 200, {
        ok: true,
        username,
        emailSent,
        /* если письмо реально не ушло — отдаём код, чтобы вход можно было завершить на экране */
        code: emailSent ? undefined : code,
        expiresInSec: 600,
        maskedEmail: String(user.email || email).replace(/(^.).+(@.*$)/, "$1***$2")
      });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/login/qr/pair/create") {
    try {
      const payload = await readBody(req);
      const requesterId = String(payload?.requesterId || "").trim() || createId();
      const deviceName = String(payload?.deviceName || "Unknown device").slice(0, 120);
      const baseUrl = String(payload?.baseUrl || "").trim();

      db.prepare("DELETE FROM qr_login_pairs WHERE requester_id = ? OR expires_at < ? OR status = 'consumed'").run(requesterId, Date.now());

      const pairCode = createPairCode();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      db.prepare(
        "INSERT INTO qr_login_pairs (pair_code, requester_id, requester_device_name, status, approved_user_id, approved_username, expires_at, created_at, consumed_at) VALUES (?, ?, ?, 'pending', NULL, NULL, ?, ?, NULL)"
      ).run(pairCode, requesterId, deviceName, expiresAt, Date.now());

      const approveUrl = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}klanzy_pair=${encodeURIComponent(pairCode)}` : "";

      sendJson(res, 200, {
        ok: true,
        pairCode,
        expiresInSec: 300,
        approveUrl
      });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/login/qr/pair/approve") {
    try {
      const payload = await readBody(req);
      const pairCode = String(payload?.pairCode || "").trim();
      const username = normalizeUsername(payload?.username || "");
      const token = String(payload?.token || "").trim();

      if (!pairCode || !username || !token) {
        sendJson(res, 400, { error: "Invalid approve payload" });
        return;
      }

      const approverSession = db
        .prepare("SELECT user_id FROM user_sessions WHERE username = ? AND token = ? LIMIT 1")
        .get(username, token);
      if (!approverSession) {
        sendJson(res, 401, { error: "Session expired" });
        return;
      }

      const pairRow = db
        .prepare("SELECT pair_code, status, expires_at FROM qr_login_pairs WHERE pair_code = ? LIMIT 1")
        .get(pairCode);
      if (!pairRow) {
        sendJson(res, 404, { error: "Pair not found" });
        return;
      }

      if (pairRow.status !== "pending") {
        sendJson(res, 409, { error: "Pair already used" });
        return;
      }

      if (Number(pairRow.expires_at) < Date.now()) {
        sendJson(res, 410, { error: "Pair expired" });
        return;
      }

      db.prepare(
        "UPDATE qr_login_pairs SET status = 'approved', approved_user_id = ?, approved_username = ? WHERE pair_code = ?"
      ).run(approverSession.user_id, username, pairCode);

      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/login/qr/pair/poll") {
    try {
      const payload = await readBody(req);
      const pairCode = String(payload?.pairCode || "").trim();
      const requesterId = String(payload?.requesterId || "").trim();
      const deviceName = String(payload?.deviceName || "Unknown device").slice(0, 120);

      if (!pairCode || !requesterId) {
        sendJson(res, 400, { error: "Invalid poll payload" });
        return;
      }

      const pairRow = db
        .prepare(
          "SELECT pair_code, requester_id, status, approved_user_id, approved_username, expires_at FROM qr_login_pairs WHERE pair_code = ? LIMIT 1"
        )
        .get(pairCode);
      if (!pairRow || pairRow.requester_id !== requesterId) {
        sendJson(res, 404, { error: "Pair not found" });
        return;
      }

      if (Number(pairRow.expires_at) < Date.now()) {
        db.prepare("DELETE FROM qr_login_pairs WHERE pair_code = ?").run(pairCode);
        sendJson(res, 410, { error: "Pair expired", status: "expired" });
        return;
      }

      if (pairRow.status !== "approved") {
        sendJson(res, 200, { ok: true, status: pairRow.status });
        return;
      }

      const user = db
        .prepare("SELECT id, nickname, username, email, avatar, badge, banned FROM users WHERE id = ? LIMIT 1")
        .get(pairRow.approved_user_id);
      if (!user || user.banned) {
        sendJson(res, 403, { error: "User unavailable" });
        return;
      }

      const session = createUserSession({
        userId: user.id,
        username: user.username,
        deviceName
      });

      db.prepare("UPDATE qr_login_pairs SET status = 'consumed', consumed_at = ? WHERE pair_code = ?").run(Date.now(), pairCode);

      sendJson(res, 200, {
        ok: true,
        status: "approved",
        profile: {
          id: user.id,
          nickname: user.nickname,
          username: user.username,
          email: user.email || "",
          avatar: user.avatar || undefined,
          badge: user.badge || undefined,
          banned: Boolean(user.banned)
        },
        session: {
          id: session.id,
          token: session.token,
          deviceName: session.deviceName,
          createdAt: session.createdAt
        },
        sessions: getUserSessions(user.username)
      });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/login/code/verify") {
    try {
      const payload = await readBody(req);
      const username = normalizeUsername(payload?.username || "");
      const code = String(payload?.code || "").trim();
      const deviceName = String(payload?.deviceName || "Unknown device");

      if (!username || !code) {
        sendJson(res, 400, { error: "Invalid credentials" });
        return;
      }

      const row = db
        .prepare(
          "SELECT c.user_id, c.expires_at, u.nickname, u.username, u.email, u.avatar, u.badge, u.banned FROM login_codes c JOIN users u ON u.id = c.user_id WHERE c.username = ? AND c.code = ? LIMIT 1"
        )
        .get(username, code);

      if (!row) {
        sendJson(res, 401, { error: "Code not found" });
        return;
      }

      if (row.banned) {
        sendJson(res, 403, { error: "User banned" });
        return;
      }

      if (Number(row.expires_at) < Date.now()) {
        db.prepare("DELETE FROM login_codes WHERE username = ?").run(username);
        sendJson(res, 401, { error: "Code expired" });
        return;
      }

      db.prepare("DELETE FROM login_codes WHERE username = ?").run(username);
      const session = createUserSession({
        userId: row.user_id,
        username: row.username,
        deviceName
      });

      sendJson(res, 200, {
        ok: true,
        profile: {
          id: row.user_id,
          nickname: row.nickname,
          username: row.username,
          email: row.email || "",
          avatar: row.avatar || undefined,
          badge: row.badge || undefined,
          banned: Boolean(row.banned)
        },
        session: {
          id: session.id,
          token: session.token,
          deviceName: session.deviceName,
          createdAt: session.createdAt
        },
        sessions: getUserSessions(row.username)
      });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/sessions/list") {
    try {
      const payload = await readBody(req);
      const username = normalizeUsername(payload?.username || "");
      const token = String(payload?.token || "");
      if (!username || !token) {
        sendJson(res, 400, { error: "Invalid session credentials" });
        return;
      }

      const session = db
        .prepare("SELECT id FROM user_sessions WHERE username = ? AND token = ? LIMIT 1")
        .get(username, token);

      if (!session) {
        sendJson(res, 401, { error: "Session expired" });
        return;
      }

      db.prepare("UPDATE user_sessions SET last_seen_at = ? WHERE id = ?").run(Date.now(), session.id);
      sendJson(res, 200, { ok: true, sessions: getUserSessions(username) });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/sessions/revoke") {
    try {
      const payload = await readBody(req);
      const username = normalizeUsername(payload?.username || "");
      const token = String(payload?.token || "");
      const targetSessionId = String(payload?.targetSessionId || "");
      const revokeAll = Boolean(payload?.revokeAll);
      const clientId = payload?.clientId;

      if (!username || !token) {
        sendJson(res, 400, { error: "Invalid session credentials" });
        return;
      }

      const session = db
        .prepare("SELECT id FROM user_sessions WHERE username = ? AND token = ? LIMIT 1")
        .get(username, token);

      if (!session) {
        sendJson(res, 401, { error: "Session expired" });
        return;
      }

      if (revokeAll) {
        db.prepare("DELETE FROM user_sessions WHERE username = ? AND id <> ?").run(username, session.id);
      } else if (targetSessionId && targetSessionId !== session.id) {
        db.prepare("DELETE FROM user_sessions WHERE username = ? AND id = ?").run(username, targetSessionId);
      }

      const sessions = getUserSessions(username);
      broadcast({ type: "sessions:update", username, sessions, clientId });
      sendJson(res, 200, { ok: true, sessions });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/blocks/toggle") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const targetUsername = normalizeUsername(payload?.targetUsername || "");
      const clientId = payload?.clientId;

      if (!actorUsername || !targetUsername || actorUsername === targetUsername) {
        sendJson(res, 400, { error: "Invalid block payload" });
        return;
      }

      const exists = db
        .prepare("SELECT 1 FROM blocks WHERE blocker_username = ? AND blocked_username = ? LIMIT 1")
        .get(actorUsername, targetUsername);

      let isBlocked = false;
      if (exists) {
        db.prepare("DELETE FROM blocks WHERE blocker_username = ? AND blocked_username = ?").run(actorUsername, targetUsername);
      } else {
        db.prepare("INSERT INTO blocks (blocker_username, blocked_username, created_at) VALUES (?, ?, ?)").run(
          actorUsername,
          targetUsername,
          Date.now()
        );
        isBlocked = true;
      }

      const blocks = getAllBlocks();
      broadcast({ type: "blocks:update", blocks, clientId });
      sendJson(res, 200, { ok: true, isBlocked, blocks });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/ban") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const targetUsername = normalizeUsername(payload?.targetUsername || "");
      const banned = Boolean(payload?.banned);
      const clientId = payload?.clientId;

      if (actorUsername !== CREATOR_USERNAME) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      if (!targetUsername || targetUsername === CREATOR_USERNAME) {
        sendJson(res, 400, { error: "Invalid target" });
        return;
      }

      db.prepare("UPDATE users SET banned = ? WHERE username = ?").run(banned ? 1 : 0, targetUsername);
      const users = getAllUsers();
      broadcast({ type: "users:update", users, clientId });
      sendJson(res, 200, { ok: true, users });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/badge/set") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const targetUsername = normalizeUsername(payload?.targetUsername || "");
      const badge = String(payload?.badge || "").trim() || null;
      const clientId = payload?.clientId;

      if (actorUsername !== CREATOR_USERNAME) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      if (!targetUsername) {
        sendJson(res, 400, { error: "Invalid target" });
        return;
      }

      const finalBadge = targetUsername === CREATOR_USERNAME ? "creator" : badge;
      db.prepare("UPDATE users SET badge = ? WHERE username = ?").run(finalBadge, targetUsername);
      const users = getAllUsers();
      broadcast({ type: "users:update", users, clientId });
      sendJson(res, 200, { ok: true, users });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login-codes/clear") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      if (actorUsername !== CREATOR_USERNAME) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      db.prepare("DELETE FROM login_codes").run();
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/sessions/revoke-user") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const targetUsername = normalizeUsername(payload?.targetUsername || "");
      const clientId = payload?.clientId;
      if (actorUsername !== CREATOR_USERNAME) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      if (!targetUsername) {
        sendJson(res, 400, { error: "Invalid target" });
        return;
      }

      db.prepare("DELETE FROM user_sessions WHERE username = ?").run(targetUsername);
      broadcast({ type: "sessions:update", username: targetUsername, sessions: [], clientId });
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/chat/delete") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const chatId = String(payload?.chatId || "");
      const clientId = payload?.clientId;

      if (actorUsername !== CREATOR_USERNAME) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      const chat = db.prepare("SELECT kind FROM chats WHERE id = ? LIMIT 1").get(chatId);
      if (!chat || (chat.kind !== "group" && chat.kind !== "channel")) {
        sendJson(res, 404, { error: "Group/channel not found" });
        return;
      }

      db.prepare("DELETE FROM chats WHERE id = ?").run(chatId);
      broadcast({ type: "chat:delete", chatId, clientId });
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/chats/delete") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const chatId = String(payload?.chatId || "");
      const clientId = payload?.clientId;

      if (!actorUsername || !chatId) {
        sendJson(res, 400, { error: "Invalid payload" });
        return;
      }

      const chat = db.prepare("SELECT kind FROM chats WHERE id = ? LIMIT 1").get(chatId);
      if (!chat || (chat.kind !== "group" && chat.kind !== "channel")) {
        sendJson(res, 404, { error: "Group/channel not found" });
        return;
      }

      if (!hasChatAdminRights(chatId, actorUsername)) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
      }

      db.prepare("DELETE FROM chats WHERE id = ?").run(chatId);
      broadcast({ type: "chat:delete", chatId, clientId });
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/chats/admins/set") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const targetUsername = normalizeUsername(payload?.targetUsername || "");
      const chatId = String(payload?.chatId || "");
      const isAdmin = Boolean(payload?.isAdmin);
      const clientId = payload?.clientId;

      if (!actorUsername || !targetUsername || !chatId) {
        sendJson(res, 400, { error: "Invalid payload" });
        return;
      }

      const chat = db.prepare("SELECT kind, owner_username FROM chats WHERE id = ? LIMIT 1").get(chatId);
      if (!chat || (chat.kind !== "group" && chat.kind !== "channel")) {
        sendJson(res, 404, { error: "Group/channel not found" });
        return;
      }

      const normalizedOwner = normalizeUsername(String(chat.owner_username || "").replace("@", ""));
      if (!hasChatAdminRights(chatId, actorUsername)) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
      }

      if (targetUsername === normalizedOwner) {
        sendJson(res, 400, { error: "Owner is already admin" });
        return;
      }

      if (isAdmin) {
        db.prepare("INSERT OR IGNORE INTO chat_admins (chat_id, username, created_at) VALUES (?, ?, ?)").run(
          chatId,
          targetUsername,
          Date.now()
        );
      } else {
        db.prepare("DELETE FROM chat_admins WHERE chat_id = ? AND username = ?").run(chatId, targetUsername);
      }

      const chatAdmins = getChatAdmins();
      broadcast({ type: "chat-admins:update", chatAdmins, clientId });
      sendJson(res, 200, { ok: true, chatAdmins });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/user/delete") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const targetUsername = normalizeUsername(payload?.targetUsername || "");
      const clientId = payload?.clientId;

      if (actorUsername !== CREATOR_USERNAME) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      if (!targetUsername || targetUsername === CREATOR_USERNAME) {
        sendJson(res, 400, { error: "Invalid target" });
        return;
      }

      const user = db.prepare("SELECT id FROM users WHERE username = ? LIMIT 1").get(targetUsername);
      if (!user) {
        sendJson(res, 404, { error: "User not found" });
        return;
      }

      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM blocks WHERE blocker_username = ? OR blocked_username = ?").run(targetUsername, targetUsername);
        db.prepare("DELETE FROM chat_admins WHERE username = ?").run(targetUsername);
        db.prepare("DELETE FROM messages WHERE sender_id = ? OR sender_username = ?").run(user.id, targetUsername);
        db.prepare("DELETE FROM chats WHERE kind = 'direct' AND username = ?").run(targetUsername);
        db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }

      const users = getAllUsers();
      const blocks = getAllBlocks();
      broadcast({ type: "users:update", users, clientId });
      broadcast({ type: "blocks:update", blocks, clientId });
      sendJson(res, 200, { ok: true, users, blocks });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/message") {
    try {
      const payload = await readBody(req);
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const clientId = payload?.clientId;
      const chatId = String(payload?.chatId || "");
      const text = String(payload?.text || "").trim();

      if (actorUsername !== CREATOR_USERNAME) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      if (!chatId || !text) {
        sendJson(res, 400, { error: "Invalid message payload" });
        return;
      }

      const chat = db.prepare("SELECT id FROM chats WHERE id = ? LIMIT 1").get(chatId);
      if (!chat) {
        sendJson(res, 404, { error: "Chat not found" });
        return;
      }

      const message = {
        id: crypto.randomUUID(),
        sender: "other",
        senderId: null,
        senderUsername: CREATOR_USERNAME,
        senderNickname: "klan3s",
        text,
        createdAt: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      };

      insertMessageStmt.run(
        message.id,
        chatId,
        message.sender,
        null,
        message.senderUsername,
        message.senderNickname,
        message.text,
        message.createdAt,
        null,
        null,
        null,
        null,
        Date.now()
      );

      broadcast({ type: "chat:message", chatId, message, chat: getAllChats().find((item) => item.id === chatId) ?? null, clientId });
      sendJson(res, 200, { ok: true, message });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/chats") {
    try {
      const payload = await readBody(req);
      const chat = payload?.chat;
      const clientId = payload?.clientId;
      const actorUsername = normalizeUsername(payload?.actorUsername || "");

      if (!chat?.id || !chat?.title || !Array.isArray(chat.messages)) {
        sendJson(res, 400, { error: "Invalid chat" });
        return;
      }

      const normalizedUsername = chat.username ? normalizeUsername(chat.username) : "";
      if (normalizedUsername) {
        const usernameUsed = db.prepare("SELECT id FROM chats WHERE username = ? LIMIT 1").get(normalizedUsername);
        if (usernameUsed && usernameUsed.id !== chat.id) {
          sendJson(res, 409, { error: "Chat username taken" });
          return;
        }
      }

      upsertChatStmt.run(
        chat.id,
        String(chat.title),
        normalizedUsername || null,
        String(chat.kind || "group"),
        chat.visibility === "private" ? "private" : "open",
        chat.subscribed ? 1 : 0,
        actorUsername || null,
        Date.now()
      );

      for (const message of chat.messages) {
        insertMessageStmt.run(
          message.id || crypto.randomUUID(),
          chat.id,
          message.sender || "other",
          message.senderId || null,
          message.senderUsername || null,
          message.senderNickname || null,
          message.text || "",
          message.createdAt || "",
          message.attachment || null,
          message.attachmentName || null,
          message.attachmentUrl || null,
          message.attachmentMime || null,
          Date.now()
        );
      }

      broadcast({
        type: "chat:create",
        chat: {
          id: chat.id,
          title: String(chat.title),
          username: normalizedUsername || undefined,
          kind: String(chat.kind || "group"),
          visibility: chat.visibility === "private" ? "private" : "open",
          subscribed: Boolean(chat.subscribed),
          /* владелец нужен получателю, чтобы понять, кто его добавил в личный чат */
          ownerUsername: actorUsername || undefined,
          messages: chat.messages
        },
        clientId
      });

      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && /^\/api\/chats\/[^/]+\/clear$/.test(url.pathname)) {
    try {
      const payload = await readBody(req);
      const clientId = payload?.clientId;
      const chatId = decodeURIComponent(url.pathname.split("/")[3]);

      const exists = db.prepare("SELECT 1 FROM chats WHERE id = ? LIMIT 1").get(chatId);
      if (!exists) {
        sendJson(res, 404, { error: "Chat not found" });
        return;
      }

      db.prepare("DELETE FROM messages WHERE chat_id = ?").run(chatId);
      broadcast({ type: "chat:clear", chatId, clientId });
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/messages/delete") {
    try {
      const payload = await readBody(req);
      const chatId = String(payload?.chatId || "");
      const messageId = String(payload?.messageId || "");
      const actorUsername = normalizeUsername(payload?.actorUsername || "");
      const clientId = payload?.clientId;

      if (!chatId || !messageId || !actorUsername) {
        sendJson(res, 400, { error: "Invalid delete payload" });
        return;
      }

      const messageRow = db
        .prepare("SELECT id, sender_username FROM messages WHERE id = ? AND chat_id = ? LIMIT 1")
        .get(messageId, chatId);

      if (!messageRow) {
        sendJson(res, 404, { error: "Message not found" });
        return;
      }

      const senderUsername = normalizeUsername(String(messageRow.sender_username || "").replace("@", ""));
      const canDelete =
        actorUsername === CREATOR_USERNAME || senderUsername === actorUsername || hasChatAdminRights(chatId, actorUsername);

      if (!canDelete) {
        sendJson(res, 403, { error: "Forbidden" });
        return;
      }

      db.prepare("DELETE FROM messages WHERE id = ? AND chat_id = ?").run(messageId, chatId);
      broadcast({
        type: "chat:message-delete",
        chatId,
        message: {
          id: messageId
        },
        clientId
      });
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/messages") {
    try {
      const payload = await readBody(req);
      const chatId = String(payload?.chatId || "");
      const message = payload?.message;
      const clientId = payload?.clientId;

      if (!chatId || !message?.id) {
        sendJson(res, 400, { error: "Invalid message" });
        return;
      }

      if (isUserBanned(message?.senderUsername || "")) {
        sendJson(res, 403, { error: "User banned" });
        return;
      }

      const chatExists = db.prepare("SELECT 1 FROM chats WHERE id = ? LIMIT 1").get(chatId);
      if (!chatExists) {
        upsertChatStmt.run(chatId, chatId, null, "group", "open", 1, null, Date.now());
      }

      insertMessageStmt.run(
        message.id,
        chatId,
        message.sender || "other",
        message.senderId || null,
        message.senderUsername || null,
        message.senderNickname || null,
        message.text || "",
        message.createdAt || "",
        message.attachment || null,
        message.attachmentName || null,
        message.attachmentUrl || null,
        message.attachmentMime || null,
        Date.now()
      );

      broadcast({ type: "chat:message", chatId, message, chat: getAllChats().find((item) => item.id === chatId) ?? null, clientId });
      sendJson(res, 200, { ok: true });
      return;
    } catch {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }
  }

  sendJson(res, 404, { error: "Not found" });
});

server.on("upgrade", (req, socket, head) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
  if (requestUrl.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (wsSocket) => {
    const clientId = requestUrl.searchParams.get("clientId") || crypto.randomUUID();
    clients.set(clientId, wsSocket);
    wss.emit("connection", wsSocket, req, clientId);
  });
});

wss.on("connection", (socket, _req, clientId) => {
  socket.on("close", () => {
    clients.delete(clientId);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Klanzy realtime server + SQLite DB listening on http://0.0.0.0:${PORT}`);
});