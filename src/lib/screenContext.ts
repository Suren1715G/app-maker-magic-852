export type VisibleScreenSnapshot = {
  path: string;
  title: string;
  content: string;
};

function extractStructured(root: HTMLElement, maxChars: number): string {
  const lines: string[] = [];
  const seen = new Set<string>();

  const push = (prefix: string, text: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return;
    const key = `${prefix}:${clean}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`${prefix} ${clean}`);
  };

  // Headings give section structure
  root.querySelectorAll("h1, h2, h3, h4").forEach((el) => {
    const tag = el.tagName.toUpperCase();
    push(`[${tag}]`, (el as HTMLElement).innerText ?? "");
  });

  // Buttons / links / tabs — what the user can act on
  root.querySelectorAll("button, a, [role='tab'], [role='menuitem']").forEach((el) => {
    const label =
      (el as HTMLElement).innerText ||
      el.getAttribute("aria-label") ||
      "";
    push("[BTN]", label);
  });

  // Explicit accessibility labels often contain the clearest screen context
  root.querySelectorAll("[aria-label]").forEach((el) => {
    const label = el.getAttribute("aria-label") || "";
    push("[LABEL]", label);
  });

  // Generic readable text (paragraphs, list items, table cells, badges)
  root
    .querySelectorAll("p, li, td, th, [role='listitem'], .badge, span")
    .forEach((el) => {
      const text = (el as HTMLElement).innerText ?? "";
      // Skip very short fragments that are likely icon labels or duplicates
      if (text.length < 2) return;
      // Skip elements that are just containers of already-captured children
      if (el.children.length > 3) return;
      push("•", text);
    });

  let out = lines.join("\n");
  if (out.length > maxChars) out = out.slice(0, maxChars) + "…";
  return out;
}

export function captureVisibleScreen(maxChars = 6000): VisibleScreenSnapshot {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { path: "/", title: "", content: "" };
  }

  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const title = document.title ?? "";
  const main = document.querySelector("main") ?? document.body;
  const content = extractStructured(main as HTMLElement, maxChars);

  return { path, title, content };
}

export async function captureVisibleScreenAfterDelay(delayMs = 700, maxChars = 6000) {
  if (delayMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  return captureVisibleScreen(maxChars);
}