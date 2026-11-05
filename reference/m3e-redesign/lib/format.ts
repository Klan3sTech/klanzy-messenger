import type { Message } from "./types";

export const initials = (value: string) => {
  const clean = (value || "?").replace(/^@/, "").trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
};

/** Стабильный оттенок из строки — для тона аватарок. */
export const hueFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
};

export const timeHM = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export const humanTime = (ts?: number) => {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeHM(ts);
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return "вчера";
  if (now.getTime() - ts < 7 * 86_400_000) return ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const plural = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
};

export const previewOf = (message?: Message) => {
  if (!message) return "Пока нет сообщений";
  const body = message.text?.trim() || (message.attachment ? `${message.attachment}` : "");
  const flat = body.replace(/\s+/g, " ");
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat;
};

export const REACTION_SET = ["👍", "💩", "🔥", "❤️", "😂", "🎉"];
