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

export function formatVisibleScreenContext(snapshot: VisibleScreenSnapshot, reason: string) {
  return [
    "SCREEN_CONTEXT_UPDATE",
    `Reason: ${reason}`,
    `Path: ${snapshot.path}`,
    snapshot.title ? `Title: ${snapshot.title}` : null,
    `Visible content: ${snapshot.content || "No readable content found on the page."}`,
    "Use this visible screen content to answer the user's latest question directly.",
    "If numbers or facts are present, say them clearly instead of saying the screen is not visible.",
  ]
    .filter(Boolean)
    .join("\n");
}