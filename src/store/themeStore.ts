import { create } from "zustand";
import { listen, emit } from "@tauri-apps/api/event";

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "gifcat-theme";
const EVENT = "gifcat://theme-changed";

function readPref(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function systemResolved(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? systemResolved() : pref;
}

function apply(theme: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
}

interface ThemeState {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (pref: ThemePref) => void;
}

const initialPref = readPref();
const initialResolved = resolve(initialPref);
apply(initialResolved);

export const useThemeStore = create<ThemeState>((set) => ({
  pref: initialPref,
  resolved: initialResolved,
  setPref(pref) {
    localStorage.setItem(KEY, pref);
    const resolved = resolve(pref);
    apply(resolved);
    set({ pref, resolved });
    emit(EVENT, pref).catch(() => {});
  },
}));

const mq = window.matchMedia("(prefers-color-scheme: dark)");
mq.addEventListener("change", () => {
  const { pref } = useThemeStore.getState();
  if (pref === "system") {
    const resolved = systemResolved();
    apply(resolved);
    useThemeStore.setState({ resolved });
  }
});

listen<ThemePref>(EVENT, (e) => {
  const incoming = e.payload;
  const { pref } = useThemeStore.getState();
  if (incoming && incoming !== pref) {
    const resolved = resolve(incoming);
    apply(resolved);
    useThemeStore.setState({ pref: incoming, resolved });
  }
}).catch(() => {});
