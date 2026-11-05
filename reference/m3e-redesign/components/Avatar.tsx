import type { CSSProperties, ReactNode } from "react";
import { M3eAvatar } from "@m3e/react/avatar";
import { M3eIcon } from "@m3e/react/icon";
import { hueFor, initials } from "../lib/format";
import type { ChatKind } from "../lib/types";

const KIND_ICON: Record<string, string> = {
  channel: "campaign",
  bot: "smart_toy",
  group: "groups",
};

export function Avatar({
  label,
  size = 46,
  kind,
  badge,
  children,
}: {
  label: string;
  size?: number;
  kind?: ChatKind;
  badge?: string;
  children?: ReactNode;
}) {
  const hue = hueFor(label);
  const style = {
    "--m3e-avatar-color": `hsl(${hue} 52% 42%)`,
    "--m3e-avatar-label-color": "#ffffff",
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.round(size * 0.36)}px`,
  } as CSSProperties;

  const iconName = kind ? KIND_ICON[kind] : undefined;

  return (
    <M3eAvatar style={style}>
      {iconName ? <M3eIcon name={iconName} style={{ fontSize: `${Math.round(size * 0.5)}px` }} /> : initials(label)}
      {badge ? <span style={{ display: "none" }}>{badge}</span> : null}
      {children}
    </M3eAvatar>
  );
}
