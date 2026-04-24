// Tiny theme helper. Persists "dark" | "light" in localStorage and toggles
// the `light` class on <html>. The dark theme is the default (no class).

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "sgs-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" ? "light" : "dark";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") {
    root.classList.add("light");
  } else {
    root.classList.remove("light");
  }
}

export function setTheme(mode: ThemeMode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }
  applyTheme(mode);
  // Notify any listening components (e.g. Settings toggle) so they re-sync.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("themechange", { detail: { mode } }));
  }
}

export function initTheme() {
  applyTheme(getStoredTheme());
}