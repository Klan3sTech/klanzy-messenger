import { useEffect, useMemo, useRef, useState } from "react";
import { M3eButton } from "@m3e/react/button";
import { M3eIcon } from "@m3e/react/icon";
import { M3eIconButton } from "@m3e/react/icon-button";
import { Avatar } from "./Avatar";
import { useStore } from "../lib/store";
import { REACTION_SET, plural, timeHM } from "../lib/format";
import type { AttachmentKind, ChatItem, Message } from "../lib/types";

const ATTACHMENTS: Array<{ kind: AttachmentKind; icon: string; hint: string }> = [
  { kind: "Фото", icon: "image", hint: "PNG, JPG" },
  { kind: "Видео", icon: "videocam", hint: "MP4, WebM" },
  { kind: "Файл", icon: "description", hint: "любой документ" },
  { kind: "Музыка", icon: "music_note", hint: "MP3, FLAC" },
];

const EMOJIS = ["👍", "💩", "🔥", "❤️", "😂", "🎉", "🦉", "🚀"];

const dayLabel = (ts: number) => {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Сегодня";
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

function subtitle(chat: ChatItem) {
  if (chat.kind === "channel") {
    const posts = chat.messages.length;
    return `${posts} ${plural(posts, "пост", "поста", "постов")} · канал`;
  }
  if (chat.kind === "group") return "группа · несколько участников";
  if (chat.kind === "bot") return "бот · отвечает сразу";
  return chat.username ? `${chat.username} · личные сообщения` : "личные сообщения";
}

function MessageRow({
  message,
  chat,
  onToggleReaction,
}: {
  message: Message;
  chat: ChatItem;
  onToggleReaction: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const mine = message.sender === "me";
  const reactions = Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0);

  return (
    <div className="minx-msg" data-mine={mine || undefined} onMouseLeave={() => setPickerOpen(false)}>
      {!mine ? <Avatar label={message.senderNickname || chat.title} kind={chat.kind} size={34} /> : null}
      <div className="minx-msg-stack">
        {!mine && chat.kind !== "direct" ? (
          <span className="minx-author">
            {message.senderNickname || chat.title}
            {message.senderUsername === "@klan3s" ? <M3eIcon name="verified" style={{ fontSize: "14px" }} /> : null}
          </span>
        ) : null}

        <div
          className="minx-bubble"
          onDoubleClick={() => setPickerOpen((prev) => !prev)}
        >
          {message.text}
          {message.attachment ? (
            <div className="minx-attachment">
              <M3eIcon
                name={ATTACHMENTS.find((item) => item.kind === message.attachment)?.icon ?? "file_present"}
                style={{ fontSize: "24px" }}
              />
              <span>
                <strong>{message.attachmentName ?? message.attachment}</strong>
                <small>{message.attachment}</small>
              </span>
              <M3eIconButton variant="standard" aria-label="Скачать">
                <M3eIcon name="download" />
              </M3eIconButton>
            </div>
          ) : null}
        </div>

        {reactions.length ? (
          <div className="minx-reactions">
            {reactions.map(([emoji, users]) => (
              <button
                key={emoji}
                type="button"
                className="minx-reaction"
                data-on={users.includes("@klan3s") || undefined}
                onClick={() => onToggleReaction(emoji)}
                title={users.join(", ")}
              >
                <span>{emoji}</span>
                <span>{users.length}</span>
              </button>
            ))}
          </div>
        ) : null}

        {pickerOpen ? (
          <div className="minx-reactions">
            {REACTION_SET.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="minx-reaction"
                onClick={() => {
                  onToggleReaction(emoji);
                  setPickerOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <div className="minx-bubble-meta">
          <span>{timeHM(message.ts)}</span>
          {mine ? <M3eIcon name="done_all" style={{ fontSize: "15px" }} /> : null}
          {!pickerOpen && !reactions.length ? (
            <button
              type="button"
              aria-label="Реакция"
              onClick={() => setPickerOpen(true)}
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: 2,
                display: "inline-grid",
                placeItems: "center",
                color: "inherit",
                opacity: 0.65,
              }}
            >
              <M3eIcon name="mood" style={{ fontSize: "15px" }} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ChatView({ onOpenSettings, isMobile }: { onOpenSettings: () => void; isMobile: boolean }) {
  const { activeChat, actions, currentUser, theme } = useStore();
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = activeChat?.messages ?? [];

  useEffect(() => {
    const scrollToBottom = () => {
      const node = bodyRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    };
    scrollToBottom();
    // мобильная панель «выезжает» с анимацией — догоняем после неё
    const t1 = window.setTimeout(scrollToBottom, 60);
    const t2 = window.setTimeout(scrollToBottom, 380);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [messages.length, activeChat?.id]);

  const grouped = useMemo(() => {
    const blocks: Array<{ key: string; label: string; items: Message[] }> = [];
    messages.forEach((message) => {
      const label = dayLabel(message.ts);
      const last = blocks[blocks.length - 1];
      if (last && last.label === label) last.items.push(message);
      else blocks.push({ key: `${label}-${message.id}`, label, items: [message] });
    });
    return blocks;
  }, [messages]);

  if (!activeChat) {
    return (
      <section className="minx-chat">
        <div className="minx-empty">
          <M3eIcon name="chat" style={{ fontSize: "64px", opacity: 0.45 }} />
          <h2>Выбери чат</h2>
          <p>Каналы, группы, боты и личные переписки — всё в Minx. Нажми «+», чтобы создать новый чат.</p>
        </div>
      </section>
    );
  }

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    actions.sendMessage(activeChat.id, text);
    setDraft("");
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      if (textRef.current) textRef.current.style.height = "auto";
    });
  };

  const sendAttachment = (kind: AttachmentKind, name: string) => {
    actions.sendMessage(activeChat.id, "", { kind, name });
    setAttachOpen(false);
  };

  return (
    <section className="minx-chat">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
          minHeight: 76,
          borderBottom: "1px solid var(--md-sys-color-outline-variant)",
          background: "var(--md-sys-color-surface-container-low)",
          position: "relative",
          zIndex: 3,
        }}
      >
        {isMobile ? (
          <M3eIconButton
            variant="standard"
            aria-label="Назад"
            onClick={() => window.dispatchEvent(new CustomEvent("minx:mobile-back"))}
          >
            <M3eIcon name="arrow_back" />
          </M3eIconButton>
        ) : null}
        <Avatar label={activeChat.title} kind={activeChat.kind} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 17, fontWeight: 500 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeChat.title}</span>
            {activeChat.ownerUsername === "@klan3s" ? (
              <M3eIcon name="verified" style={{ fontSize: "16px", color: "var(--md-sys-color-primary)" }} />
            ) : null}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--md-sys-color-on-surface-variant)" }}>{subtitle(activeChat)}</div>
        </div>
        <M3eIconButton variant="standard" aria-label="Поиск в чате">
          <M3eIcon name="search" />
        </M3eIconButton>
        <M3eIconButton variant="standard" aria-label="Ещё" onClick={onOpenSettings}>
          <M3eIcon name="more_vert" />
        </M3eIconButton>
      </div>

      <div className="minx-chat-body" ref={bodyRef}>
        {grouped.map((block) => (
          <div key={block.key} style={{ display: "contents" }}>
            <div className="minx-day">{block.label}</div>
            {block.items.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                chat={activeChat}
                onToggleReaction={(emoji) => actions.toggleReaction(activeChat.id, message.id, emoji)}
              />
            ))}
          </div>
        ))}

        {!messages.length ? (
          <div className="minx-empty">
            <M3eIcon name="chat_bubble" style={{ fontSize: "56px", opacity: 0.45 }} />
            <h2>Пока тихо</h2>
            <p>Напиши первое сообщение — и начнём.</p>
          </div>
        ) : null}
      </div>

      <div className="minx-composer">
        {emojiOpen ? (
          <div className="minx-emoji-pop">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setDraft((prev) => prev + emoji);
                  textRef.current?.focus();
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        {attachOpen ? (
          <div
            className="minx-emoji-pop"
            style={{ flexDirection: "column", borderRadius: 24, gap: 2, padding: 8, bottom: 96 }}
          >
            {ATTACHMENTS.map((item) => (
              <M3eButton
                key={item.kind}
                variant="text"
                onClick={() => sendAttachment(item.kind, `${item.kind.toLowerCase()}-${Date.now()}`)}
              >
                <M3eIcon slot="icon" name={item.icon} />
                {item.kind}
              </M3eButton>
            ))}
          </div>
        ) : null}

        <M3eIconButton variant="tonal" aria-label="Вложение" onClick={() => setAttachOpen((prev) => !prev)}>
          <M3eIcon name="attach_file" />
        </M3eIconButton>

        <div className="minx-composer-field">
          <m3e-form-field variant="filled" hide-subscript="always">
            <textarea
              ref={textRef}
              rows={1}
              placeholder={
                activeChat.kind === "bot"
                  ? "Сообщение боту… (/help)"
                  : activeChat.kind === "channel"
                    ? "Сообщение в канал…"
                    : "Сообщение…"
              }
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                const el = event.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <M3eIconButton
              slot="suffix"
              variant="standard"
              aria-label="Эмодзи"
              onClick={() => setEmojiOpen((prev) => !prev)}
            >
              <M3eIcon name="mood" />
            </M3eIconButton>
          </m3e-form-field>
        </div>

        <M3eIconButton variant="filled" aria-label="Отправить" disabled={!draft.trim() || undefined} onClick={send}>
          <M3eIcon name="send" />
        </M3eIconButton>
      </div>

      <span style={{ display: "none" }}>{`${currentUser?.username ?? ""}:${theme}`}</span>
    </section>
  );
}
