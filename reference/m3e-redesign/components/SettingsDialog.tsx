import { useEffect, useState } from "react";
import { M3eButton } from "@m3e/react/button";
import { M3eDialog } from "@m3e/react/dialog";
import { M3eIcon } from "@m3e/react/icon";
import { M3eIconButton } from "@m3e/react/icon-button";
import { M3eSegmentedButton, M3eButtonSegment } from "@m3e/react/segmented-button";
import { Avatar } from "./Avatar";
import { useStore } from "../lib/store";
import { CREATOR } from "../lib/store";
import { humanTime } from "../lib/format";
import type { ThemeMode } from "../lib/types";

const ACCENTS = ["#6750A4", "#0B6BCB", "#00696D", "#4F6B22", "#8B5000", "#984061", "#7C4DFF", "#B3261E"];

const TABS = [
  { id: "profile", label: "Профиль", icon: "person" },
  { id: "look", label: "Оформление", icon: "palette" },
  { id: "devices", label: "Устройства", icon: "devices" },
  { id: "admin", label: "Админ", icon: "admin_panel_settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser, users, sessions, theme, accent, isCreator, online, actions } = useStore();
  const [tab, setTab] = useState<TabId>("profile");
  const [nickname, setNickname] = useState(currentUser?.nickname ?? "");
  const [username, setUsername] = useState(currentUser?.username ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");

  useEffect(() => {
    if (!open) return;
    setNickname(currentUser?.nickname ?? "");
    setUsername(currentUser?.username ?? "");
    setEmail(currentUser?.email ?? "");
    void actions.refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUser?.username]);

  const visibleTabs = TABS.filter((item) => item.id !== "admin" || isCreator);

  return (
    <M3eDialog open={open} onClosed={onClose} style={{ "--m3e-dialog-max-width": "720px", "--m3e-dialog-min-width": "min(680px, 92vw)", "--m3e-dialog-max-height": "86vh" } as React.CSSProperties}>
      <div slot="header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <M3eIcon name="settings" />
        Настройки
      </div>

      <div className="minx-dialog-body">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {visibleTabs.map((item) => (
            <M3eButton
              key={item.id}
              variant={tab === item.id ? "tonal" : "text"}
              size="small"
              onClick={() => setTab(item.id)}
            >
              <M3eIcon slot="icon" name={item.icon} />
              {item.label}
            </M3eButton>
          ))}
        </div>

        {tab === "profile" ? (
          <div className="minx-form">
            <div className="minx-tile">
              <Avatar label={currentUser?.username ?? "Minx"} size={56} />
              <div className="minx-tile-body">
                <strong>{currentUser?.nickname}</strong>
                <small>{currentUser?.username}</small>
              </div>
              {currentUser?.badge ? <span className="minx-chip-static">{currentUser.badge}</span> : null}
            </div>

            <m3e-form-field variant="outlined">
              <m3e-icon slot="prefix" name="person" />
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
              <span slot="label">Ник</span>
            </m3e-form-field>

            <m3e-form-field variant="outlined">
              <m3e-icon slot="prefix" name="tag" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
              <span slot="label">Username</span>
            </m3e-form-field>

            <m3e-form-field variant="outlined">
              <m3e-icon slot="prefix" name="mail" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
              <span slot="label">Почта</span>
            </m3e-form-field>

            <div className="minx-row-actions">
              <M3eButton
                variant="filled"
                onClick={() =>
                  void actions.updateProfile({
                    ...(currentUser ?? { nickname: "", username: "" }),
                    nickname,
                    username,
                    email,
                  })
                }
              >
                <M3eIcon slot="icon" name="check" />
                Сохранить
              </M3eButton>
              <M3eButton variant="text" onClick={actions.logout}>
                <M3eIcon slot="icon" name="logout" />
                Выйти
              </M3eButton>
            </div>
          </div>
        ) : null}

        {tab === "look" ? (
          <div className="minx-form">
            <div className="minx-section-title">Схема</div>
            <M3eSegmentedButton
              style={{ width: "100%" }}
              onChange={(event: Event) => {
                const value = (event.target as HTMLElement & { value?: string }).value;
                if (value) actions.setTheme(value as ThemeMode);
              }}
            >
              <M3eButtonSegment value="light" checked={theme === "light" || undefined}>
                Светлая
              </M3eButtonSegment>
              <M3eButtonSegment value="dark" checked={theme === "dark" || undefined}>
                Тёмная
              </M3eButtonSegment>
              <M3eButtonSegment value="auto" checked={theme === "auto" || undefined}>
                Система
              </M3eButtonSegment>
            </M3eSegmentedButton>

            <div className="minx-section-title">Акцент (dynamic color)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="minx-swatch"
                  data-on={accent.toLowerCase() === color.toLowerCase() || undefined}
                  style={{ background: color }}
                  aria-label={color}
                  onClick={() => actions.setAccent(color)}
                />
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--md-sys-color-on-surface-variant)" }}>
              Палитра пересобирается из одного seed-цвета через <code>{"<m3e-theme color=\"…\">"}</code> — все токены
              (primary, container, outline) пересчитываются автоматически.
            </p>
          </div>
        ) : null}

        {tab === "devices" ? (
          <div className="minx-form">
            <div className="minx-tile">
              <M3eIcon name="devices" style={{ fontSize: "26px" }} />
              <div className="minx-tile-body">
                <strong>Активные сессии</strong>
                <small>{online ? "Данные с сервера Minx" : "Локальный режим — сессии недоступны"}</small>
              </div>
              <M3eIconButton variant="standard" aria-label="Обновить" onClick={() => void actions.refreshSessions()}>
                <M3eIcon name="refresh" />
              </M3eIconButton>
            </div>

            {sessions.length ? (
              sessions.map((session) => (
                <div key={session.id} className="minx-tile">
                  <M3eIcon name="key" style={{ fontSize: "24px" }} />
                  <div className="minx-tile-body">
                    <strong>{session.deviceName}</strong>
                    <small>вход {humanTime(session.createdAt)} · активность {humanTime(session.lastSeenAt)}</small>
                  </div>
                  <M3eButton variant="text" onClick={() => void actions.revokeSession(session.id)}>
                    Отключить
                  </M3eButton>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 13 }}>
                Пока нет данных о сессиях. На сервере они появятся после входа по коду или QR.
              </p>
            )}
          </div>
        ) : null}

        {tab === "admin" && isCreator ? (
          <div className="minx-form">
            <div className="minx-tile">
              <M3eIcon name="shield" style={{ fontSize: "26px" }} />
              <div className="minx-tile-body">
                <strong>Админ-панель</strong>
                <small>доступ только для {CREATOR}</small>
              </div>
              <span className="minx-chip-static">owner</span>
            </div>

            {users.map((user) => (
              <div key={user.username} className="minx-tile">
                <Avatar label={user.username} size={40} />
                <div className="minx-tile-body">
                  <strong>
                    {user.nickname} {user.banned ? <span style={{ color: "var(--md-sys-color-error)" }}>· бан</span> : null}
                  </strong>
                  <small>
                    {user.username} {user.badge ? `· ${user.badge}` : ""}
                  </small>
                </div>
                <div className="minx-row-actions">
                  <M3eButton variant="text" size="small" onClick={() => actions.adminBadge(user.username, user.badge === "verified" ? "" : "verified")}>
                    {user.badge === "verified" ? "Снять ✓" : "Выдать ✓"}
                  </M3eButton>
                  <M3eButton
                    variant="text"
                    size="small"
                    disabled={user.username === CREATOR || undefined}
                    onClick={() => actions.adminBan(user.username, !user.banned)}
                  >
                    {user.banned ? "Разблок" : "Бан"}
                  </M3eButton>
                  <M3eIconButton
                    variant="standard"
                    aria-label="Удалить"
                    disabled={user.username === CREATOR || undefined}
                    onClick={() => actions.adminDeleteUser(user.username)}
                  >
                    <M3eIcon name="delete" />
                  </M3eIconButton>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div slot="actions">
        <M3eButton variant="text" onClick={onClose}>
          Закрыть
        </M3eButton>
      </div>
    </M3eDialog>
  );
}
