import { useState } from "react";
import { M3eButton } from "@m3e/react/button";
import { M3eDialog } from "@m3e/react/dialog";
import { M3eIcon } from "@m3e/react/icon";
import { M3eSegmentedButton, M3eButtonSegment } from "@m3e/react/segmented-button";
import { useStore } from "../lib/store";
import type { ChatKind } from "../lib/types";

const KINDS: Array<{ id: ChatKind; label: string; icon: string; hint: string }> = [
  { id: "group", label: "Группа", icon: "groups", hint: "общий чат с участниками" },
  { id: "channel", label: "Канал", icon: "campaign", hint: "посты в одну сторону" },
  { id: "bot", label: "Бот", icon: "smart_toy", hint: "авто-ответы на команды" },
  { id: "direct", label: "Личка", icon: "person", hint: "переписка один на один" },
];

export function CreateChatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useStore();
  const [kind, setKind] = useState<ChatKind>("group");
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const current = KINDS.find((item) => item.id === kind) ?? KINDS[0];

  const create = async () => {
    const chat = await actions.createChat({
      title,
      username: username || undefined,
      kind,
      visibility: isPrivate ? "private" : "open",
    });
    if (chat) {
      setTitle("");
      setUsername("");
      onClose();
    }
  };

  return (
    <M3eDialog open={open} onClosed={onClose} style={{ "--m3e-dialog-max-width": "600px", "--m3e-dialog-min-width": "min(520px, 92vw)", "--m3e-dialog-max-height": "86vh" } as React.CSSProperties}>
      <div slot="header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <M3eIcon name="group_add" />
        Новый чат
      </div>

      <div className="minx-dialog-body">
        <M3eSegmentedButton
          style={{ width: "100%" }}
          onChange={(event: Event) => {
            const value = (event.target as HTMLElement & { value?: string }).value;
            if (value) setKind(value as ChatKind);
          }}
        >
          {KINDS.map((item) => (
            <M3eButtonSegment key={item.id} value={item.id} checked={kind === item.id || undefined}>
              {item.label}
            </M3eButtonSegment>
          ))}
        </M3eSegmentedButton>

        <p style={{ margin: 0, fontSize: 12.5, color: "var(--md-sys-color-on-surface-variant)" }}>
          {current.hint}
        </p>

        <m3e-form-field variant="outlined">
          <m3e-icon slot="prefix" name={current.icon} />
          <input placeholder="Например, Minx Team" value={title} onChange={(event) => setTitle(event.target.value)} />
          <span slot="label">Название</span>
        </m3e-form-field>

        <m3e-form-field variant="outlined">
          <m3e-icon slot="prefix" name="tag" />
          <input placeholder="@username" value={username} onChange={(event) => setUsername(event.target.value)} />
          <span slot="label">Публичный @username</span>
          <span slot="hint">Необязательно</span>
        </m3e-form-field>

        <div className="minx-tile">
          <M3eIcon name="lock" style={{ fontSize: "24px" }} />
          <div className="minx-tile-body">
            <strong>Приватный чат</strong>
            <small>виден только по приглашению</small>
          </div>
          <m3e-switch checked={isPrivate || undefined} onChange={(event: Event) => setIsPrivate((event.target as HTMLInputElement).checked)} />
        </div>
      </div>

      <div slot="actions">
        <M3eButton variant="text" onClick={onClose}>
          Отмена
        </M3eButton>
        <M3eButton variant="filled" onClick={create} disabled={!title.trim() || undefined}>
          <M3eIcon slot="icon" name="add" />
          Создать
        </M3eButton>
      </div>
    </M3eDialog>
  );
}
