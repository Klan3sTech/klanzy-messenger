import { useCallback, useEffect, useMemo, useState } from "react";
import { M3eFab } from "@m3e/react/fab";
import { M3eIcon } from "@m3e/react/icon";
import { M3eIconButton } from "@m3e/react/icon-button";
import { M3eTheme } from "@m3e/react/theme";
import "./lib/m3e-setup";
import "./lib/icons";
import { MinxProvider, useStore } from "./lib/store";
import { useIsMobile } from "./lib/useMedia";
import { AuthScreen } from "./components/AuthScreen";
import { ChatListPane } from "./components/ChatListPane";
import { ChatView } from "./components/ChatView";
import { CreateChatDialog } from "./components/CreateChatDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import type { Section } from "./lib/types";

const RAIL: Array<{ id: Section; label: string; icon: string }> = [
  { id: "chats", label: "Чаты", icon: "chat" },
  { id: "channels", label: "Каналы", icon: "campaign" },
  { id: "groups", label: "Группы", icon: "groups" },
  { id: "bots", label: "Боты", icon: "smart_toy" },
];

function Rail({ onCreate, onSettings }: { onCreate: () => void; onSettings: () => void }) {
  const { sections, actions, currentUser, theme, chats } = useStore();
  const unread = useMemo(() => chats.reduce((sum, chat) => sum + (chat.unread ?? 0), 0), [chats]);

  return (
    <nav className="minx-rail" aria-label="Основная навигация">
      <div className="minx-rail-brand" aria-hidden>
        M
      </div>

      <M3eFab
        variant="primary-container"
        size="medium"
        extended
        onClick={onCreate}
        style={{ alignSelf: "stretch", margin: "0 12px 14px" }}
      >
        <M3eIcon name="add" />
        <span slot="label">Новый чат</span>
      </M3eFab>

      <div className="minx-rail-items">
        {RAIL.map((item) => (
          <button
            key={item.id}
            type="button"
            className="minx-rail-item"
            data-active={sections === item.id || undefined}
            onClick={() => actions.setSection(item.id)}
          >
            <span className="minx-rail-indicator">
              <M3eIcon name={item.icon} />
            </span>
            <span className="minx-rail-label">{item.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div className="minx-rail-foot">
        <M3eIconButton
          variant="standard"
          aria-label="Сменить тему"
          onClick={() => actions.setTheme(theme === "dark" ? "light" : "dark")}
        >
          <M3eIcon name={theme === "dark" ? "light_mode" : "dark_mode"} />
        </M3eIconButton>
        <M3eIconButton variant="standard" aria-label="Настройки" onClick={onSettings}>
          <M3eIcon name="settings" />
        </M3eIconButton>
        <button type="button" className="minx-rail-avatar" onClick={onSettings} aria-label={currentUser?.nickname}>
          {(currentUser?.nickname ?? "M").slice(0, 1).toUpperCase()}
          {unread ? <span className="minx-rail-badge">{unread > 99 ? "99+" : unread}</span> : null}
        </button>
      </div>
    </nav>
  );
}

function MobileBar({ onCreate, onSettings }: { onCreate: () => void; onSettings: () => void }) {
  const { sections, actions } = useStore();
  return (
    <div className="minx-mobile-bar">
      {RAIL.map((item) => (
        <button
          key={item.id}
          type="button"
          className="minx-rail-item"
          data-active={sections === item.id || undefined}
          onClick={() => actions.setSection(item.id)}
        >
          <span className="minx-rail-indicator">
            <M3eIcon name={item.icon} />
          </span>
          <span className="minx-rail-label">{item.label}</span>
        </button>
      ))}
      <button type="button" className="minx-rail-item" onClick={onSettings}>
        <span className="minx-rail-indicator">
          <M3eIcon name="settings" />
        </span>
        <span className="minx-rail-label">Ещё</span>
      </button>
      <button type="button" className="minx-rail-item" onClick={onCreate}>
        <span className="minx-rail-indicator">
          <M3eIcon name="add" />
        </span>
        <span className="minx-rail-label">Создать</span>
      </button>
    </div>
  );
}

function Toasts() {
  const { toasts, actions } = useStore();
  const current = toasts[toasts.length - 1];
  return (
    <m3e-snackbar
      open={Boolean(current) || undefined}
      duration={3000}
      onToggle={(event: Event) => {
        const evt = event as unknown as { newState?: string };
        if (evt.newState === "closed" && current) actions.dismissToast(current.id);
      }}
    >
      {current?.text ?? ""}
    </m3e-snackbar>
  );
}

function Shell() {
  const { activeChatId, actions, actions: storeActions } = useStore();
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openCreate = useCallback(() => setCreateOpen(true), []);

  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener("minx:settings", handler);
    return () => window.removeEventListener("minx:settings", handler);
  }, []);

  useEffect(() => {
    const back = () => setMobileChat(false);
    window.addEventListener("minx:mobile-back", back);
    return () => window.removeEventListener("minx:mobile-back", back);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileChat(false);
  }, [isMobile]);

  const selectChat = (id: string) => {
    storeActions.selectChat(id);
    if (isMobile) setMobileChat(true);
  };

  return (
    <>
      <div className="minx-shell" data-mobile-chat={isMobile && mobileChat && activeChatId ? "true" : undefined}>
        <Rail onCreate={openCreate} onSettings={openSettings} />
        <ChatListPane onCreate={openCreate} onSelect={selectChat} onSettings={openSettings} />
        <ChatView onOpenSettings={openSettings} isMobile={isMobile} />
      </div>

      {isMobile ? <MobileBar onCreate={openCreate} onSettings={openSettings} /> : null}

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CreateChatDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <Toasts />
      <span style={{ display: "none" }}>{actions ? "" : ""}</span>
    </>
  );
}

function Themed() {
  const { currentUser, theme, accent } = useStore();
  return (
    <M3eTheme
      variant="tonal-spot"
      motion="expressive"
      color={accent}
      scheme={theme}
      style={{ display: "block", height: "100%" }}
    >
      {currentUser ? <Shell /> : <AuthScreen />}
    </M3eTheme>
  );
}

export default function App() {
  return (
    <MinxProvider>
      <Themed />
    </MinxProvider>
  );
}
