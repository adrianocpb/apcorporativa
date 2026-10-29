"use client";

import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<ThemePreference, string> = {
  system: "Tema: automático",
  light: "Tema: claro",
  dark: "Tema: escuro",
};

/** Alterna claro → escuro → automático. A escolha fica em cookie para o servidor renderizar sem piscar. */
export function ThemeToggle({ initial }: { initial: ThemePreference }) {
  const [theme, setTheme] = useState<ThemePreference>(initial);
  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    document.cookie = `apc_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
  }
  const Icon = theme === "light" ? IconSun : theme === "dark" ? IconMoon : IconDeviceDesktop;
  return (
    <button
      type="button"
      onClick={cycle}
      className="flex size-[38px] items-center justify-center rounded-md text-ink-soft hover:bg-surface-hover"
      aria-label={`${LABEL[theme]}. Clique para alternar.`}
      title={LABEL[theme]}
    >
      <Icon className="size-[22px]" aria-hidden="true" />
    </button>
  );
}
