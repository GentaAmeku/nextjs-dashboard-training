import { type LucideIcon, Moon, Sun } from "lucide-react";

export type ThemeDef = {
  /** next-themes が使用するテーマ識別子。globals.css のクラス名と一致させること */
  id: string;
  label: string;
  Icon: LucideIcon;
};

export const THEMES: ThemeDef[] = [
  { id: "light", label: "ライト", Icon: Sun },
  { id: "dark", label: "ダーク", Icon: Moon },
];

export const THEME_IDS = THEMES.map((t) => t.id);
