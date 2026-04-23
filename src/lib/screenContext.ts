export type VisibleScreenSnapshot = {
  path: string;
  title: string;
  content: string;
};

export function captureVisibleScreen(maxChars = 5000): VisibleScreenSnapshot {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { path: "/", title: "", content: "" };
  }

  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const title = document.title ?? "";
  const main = document.querySelector("main") ?? document.body;
  const raw = (main as HTMLElement).innerText ?? "";
  const content = raw.replace(/\s+/g, " ").trim().slice(0, maxChars);

  return { path, title, content };
}

export async function captureVisibleScreenAfterDelay(delayMs = 700, maxChars = 5000) {
  if (delayMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  return captureVisibleScreen(maxChars);
}