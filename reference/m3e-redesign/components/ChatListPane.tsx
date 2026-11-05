import { useMemo, useState } from "react";
import { M3eBadge } from "@m3e/react/badge";
import { M3eFab } from "@m3e/react/fab";
import { M3eFilterChip } from "@m3e/react/chips";
import { M3eIcon } from "@m3e/react/icon";
import { M3eIconButton } from "@m3e/react/icon-button";
import { Avatar } from "./Avatar";
import { useStore } from "../lib/store";
import { humanTime, previewOf } from "../lib/format";
import type { ChatItem, Section } from "../lib/types";

const TITLES: Record<Section, string> = {
  chats: "Чаты",
  channels: "Каналы",
  groups: "Группы",
  bots: "Боты",
};

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "unread", label: "Непрочитанные" },
  { id: "mine", label: "Мои" },
] as const;

function matchesSection(chat: ChatItem, section: Section) {
  if (section === "chats") return chat.kind === "direct" || chat.kind === "group";
  if (section === "channels") return chat.kind === "channel";
  if (section === "groups") return chat.kind === "group";
  return chat.kind === "bot";
}

export function ChatListPane({
  onCreate,
  onSelect,
  onSettings,
}: {
  onCreate: () => void;
  onSelect: (id: string) => void;
  onSettings: () => void;
}) {
  const { chats, sections, activeChatId, search, actions, currentUser } = useStore();
  const [filter, setFilter] = useState<string>("all");

  const list = useMemo(() => {
    const query = search.trim().toLowerCase();
    return chats
      .filter((chat) => matchesSection(chat, sections))
      .filter((chat) => {
        if (filter === "unread") return (chat.unread ?? 0) > 0;
        if (filter === "mine") return chat.ownerUsername === currentUser?.username;
        return true;
      })
      .filter((chat) => {
        if (!query) return true;
        const last = chat.messages[chat.messages.length - 1];
        return (
          chat.title.toLowerCase().includes(query) ||
          (chat.username ?? "").toLowerCase().includes(query) ||
          (last?.text ?? "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const at = a.messages[a.messages.length - 1]?.ts ?? a.createdAt ?? 0;
        const bt = b.messages[b.messages.length - 1]?.ts ?? b.createdAt ?? 0;
        return bt - at;
      });
  }, [chats, sections, search, filter, currentUser?.username]);

  return (
    <section className="minx-list" aria-label={TITLES[sections]}>
      <div className="minx-list-head">
        <h1>{TITLES[sections]}</h1>
        <div className="minx-list-tools">
          <M3eIconButton variant="standard" aria-label="Поиск" onClick={() => document.getElementById("minx-search-input")?.focus()}>
            <M3eIcon name="search" />
          </M3eIconButton>
          <M3eIconButton variant="standard" aria-label="Настройки" onClick={onSettings}>
            <M3eIcon name="settings" />
          </M3eIconButton>
        </div>
      </div>

      <div className="minx-search">
        <m3e-form-field variant="filled" hide-subscript="always">
          <m3e-icon slot="prefix" name="search" />
          <input
            id="minx-search-input"
            placeholder="Поиск в Minx"
            value={search}
            onChange={(event) => actions.setSearch(event.target.value)}
          />
        </m3e-form-field>
      </div>

      <div className="minx-chips">
        {FILTERS.map((item) => (
          <M3eFilterChip
            key={item.id}
            selected={filter === item.id || undefined}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </M3eFilterChip>
        ))}
      </div>

      <div className="minx-scroll">
        {list.map((chat) => {
          const last = chat.messages[chat.messages.length - 1];
          const mine = last?.sender === "me";
          return (
            <button
              key={chat.id}
              type="button"
              className="minx-row"
              data-active={chat.id === activeChatId || undefined}
              onClick={() => onSelect(chat.id)}
            >
              {chat.unread ? (
                <M3eBadge>
                  <Avatar label={chat.title} kind={chat.kind} />
                </M3eBadge>
              ) : (
                <Avatar label={chat.title} kind={chat.kind} />
              )}
              <span className="minx-row-body">
                <span className="minx-row-top">
                  <span className="minx-row-title">{chat.title}</span>
                  {last ? <span className="minx-row-time">{humanTime(last.ts)}</span> : null}
                </span>
                <span className="minx-row-preview">
                  {mine ? <M3eIcon name="done_all" style={{ fontSize: "15px" }} /> : null}
                  <span>{previewOf(last)}</span>
                </span>
              </span>
              {chat.unread ? <span className="minx-unread">{chat.unread > 99 ? "99+" : chat.unread}</span> : null}
            </button>
          );
        })}

        {!list.length ? (
          <div className="minx-empty" style={{ paddingTop: 60 }}>
            <M3eIcon name="forum" style={{ fontSize: "52px", opacity: 0.5 }} />
            <h2>Пусто</h2>
            <p>Ничего не найдено. Измени фильтр или создай новый чат.</p>
          </div>
        ) : null}
      </div>

      <div className="minx-fab-slot">
        <M3eFab variant="primary" size="medium" onClick={onCreate}>
          <M3eIcon name="add" />
        </M3eFab>
      </div>
    </section>
  );
}
