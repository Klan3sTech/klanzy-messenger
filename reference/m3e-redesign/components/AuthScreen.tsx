import { useState } from "react";
import { M3eButton } from "@m3e/react/button";
import { M3eIcon } from "@m3e/react/icon";
import { M3eIconButton } from "@m3e/react/icon-button";
import { M3eSegmentedButton, M3eButtonSegment } from "@m3e/react/segmented-button";
import { useStore } from "../lib/store";
import { demoUsers } from "../lib/demo";

type Mode = "login" | "register";

export function AuthScreen() {
  const { actions, online, users } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const quick = users.filter((user) => user.badge !== "bot").slice(0, 5);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "register") {
        await actions.register({ nickname, username, email });
      } else {
        await actions.login(username, code || "000000");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="minx-auth">
      <div className="minx-auth-card">
        <div className="minx-auth-logo">M</div>

        <div>
          <h1>Minx</h1>
          <p style={{ marginTop: 6 }}>
            Мессенджер на <b>Material 3 Expressive</b>: каналы, группы, боты, реакции и тред-навигация.
            {online ? " Сервер на связи." : " Сервер недоступен — включён локальный режим."}
          </p>
        </div>

        <M3eSegmentedButton
          style={{ width: "100%" }}
          onChange={(event: Event) => {
            const target = event.target as HTMLElement & { value?: string };
            const next = (target.value ?? "").includes("register") ? "register" : "login";
            setMode(next as Mode);
          }}
        >
          <M3eButtonSegment value="login" checked={mode === "login" || undefined}>
            Вход
          </M3eButtonSegment>
          <M3eButtonSegment value="register" checked={mode === "register" || undefined}>
            Регистрация
          </M3eButtonSegment>
        </M3eSegmentedButton>

        <div className="minx-form">
          {mode === "register" ? (
            <m3e-form-field variant="outlined">
              <m3e-icon slot="prefix" name="person" />
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
              <span slot="label">Ник</span>
            </m3e-form-field>
          ) : null}

          <m3e-form-field variant="outlined">
            <m3e-icon slot="prefix" name="tag" />
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
            <span slot="label">@username</span>
          </m3e-form-field>

          {mode === "register" ? (
            <m3e-form-field variant="outlined">
              <m3e-icon slot="prefix" name="mail" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span slot="label">Почта</span>
            </m3e-form-field>
          ) : (
            <m3e-form-field variant="outlined">
              <m3e-icon slot="prefix" name="key" />
              <input value={code} onChange={(e) => setCode(e.target.value)} />
              <span slot="label">Код из письма</span>
              <span slot="hint">Демо: любой код</span>
            </m3e-form-field>
          )}
        </div>

        <M3eButton variant="filled" style={{ width: "100%" }} disabled={busy || undefined} onClick={submit}>
          <M3eIcon slot="icon" name={mode === "register" ? "how_to_reg" : "login"} />
          {mode === "register" ? "Создать аккаунт" : "Войти в Minx"}
        </M3eButton>

        <div>
          <div className="minx-section-title" style={{ marginBottom: 8 }}>
            Быстрый вход (демо)
          </div>
          <div className="minx-quick">
            {quick.map((user) => (
              <M3eButton
                key={user.username}
                variant="tonal"
                size="small"
                onClick={() => {
                  void actions.loginDemo(user.username);
                }}
              >
                {user.nickname}
                {user.username === "@klan3s" ? " 👑" : ""}
              </M3eButton>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--md-sys-color-on-surface-variant)", fontSize: 12.5 }}>
          <M3eIconButton variant="standard" aria-label="Помощь">
            <M3eIcon name="support_agent" />
          </M3eIconButton>
          <span>
            Аккаунты хранятся в SQLite на бэкенде. В демо-режиме данные живут в браузере и синхронизируются между вкладками.
          </span>
        </div>
      </div>
      <span style={{ display: "none" }}>{demoUsers.length}</span>
    </div>
  );
}
