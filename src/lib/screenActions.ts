// Helpers for the Jarvis assistant to click and fill things on the visible page.
// All matching is text-based so the AI can refer to elements the way the user sees them.

function normalize(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function visible(el: Element) {
  const r = (el as HTMLElement).getBoundingClientRect?.();
  if (!r) return false;
  if (r.width === 0 && r.height === 0) return false;
  const style = window.getComputedStyle(el as HTMLElement);
  if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none" && (el as HTMLElement).tagName !== "INPUT") {
    return false;
  }
  return true;
}

function elementLabel(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const text = (el as HTMLElement).innerText || el.textContent || "";
  return text;
}

function score(needle: string, hay: string) {
  const n = normalize(needle);
  const h = normalize(hay);
  if (!n || !h) return 0;
  if (h === n) return 1000;
  if (h.startsWith(n)) return 500 - (h.length - n.length);
  if (h.includes(n)) return 250 - (h.length - n.length);
  return 0;
}

const CLICKABLE_SELECTOR =
  "button, a, [role='button'], [role='tab'], [role='menuitem'], [role='link'], [role='switch'], [role='checkbox'], input[type='button'], input[type='submit'], summary";

const DESTRUCTIVE = /\b(delete|remove|cancel subscription|sign out|log out|disconnect|unsubscribe|destroy|drop|wipe|reset|revoke)\b/i;

export type ClickResult =
  | { ok: true; matched: string; destructive: boolean }
  | { ok: false; reason: string; candidates?: string[] };

export function clickByLabel(label: string, opts?: { allowDestructive?: boolean }): ClickResult {
  if (!label || typeof document === "undefined") {
    return { ok: false, reason: "No label provided" };
  }
  const main = document.querySelector("main") ?? document.body;
  const candidates = Array.from(main.querySelectorAll(CLICKABLE_SELECTOR)).filter(visible);

  let best: { el: Element; label: string; score: number } | null = null;
  for (const el of candidates) {
    const lbl = elementLabel(el);
    const s = score(label, lbl);
    if (s > 0 && (!best || s > best.score)) best = { el, label: lbl, score: s };
  }

  if (!best) {
    const sample = candidates
      .map((el) => normalize(elementLabel(el)))
      .filter((s) => s.length > 0 && s.length < 60)
      .slice(0, 20);
    return { ok: false, reason: `No clickable element matches "${label}".`, candidates: sample };
  }

  const isDestructive = DESTRUCTIVE.test(best.label);
  if (isDestructive && !opts?.allowDestructive) {
    return {
      ok: false,
      reason: `Refused: "${best.label.trim()}" looks destructive. Confirm with the user, then call again with confirmed=true.`,
    };
  }

  (best.el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
  (best.el as HTMLElement).click();
  return { ok: true, matched: best.label.trim().slice(0, 80), destructive: isDestructive };
}

const FIELD_SELECTOR =
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio']), textarea, [contenteditable='true']";

function findFieldLabel(el: Element): string {
  // 1. <label for=id>
  const id = el.id;
  if (id) {
    const lbl = document.querySelector(`label[for='${CSS.escape(id)}']`);
    if (lbl) return (lbl as HTMLElement).innerText || lbl.textContent || "";
  }
  // 2. wrapped in <label>
  let p: Element | null = el.parentElement;
  let depth = 0;
  while (p && depth < 4) {
    if (p.tagName === "LABEL") return (p as HTMLElement).innerText || p.textContent || "";
    p = p.parentElement;
    depth++;
  }
  // 3. aria-label / placeholder / name
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder") ||
    el.getAttribute("name") ||
    ""
  );
}

export type FillResult =
  | { ok: true; matchedLabel: string }
  | { ok: false; reason: string; candidates?: string[] };

export function fillFieldByLabel(label: string, value: string): FillResult {
  if (!label || typeof document === "undefined") {
    return { ok: false, reason: "No field label provided" };
  }
  const main = document.querySelector("main") ?? document.body;
  const fields = Array.from(main.querySelectorAll(FIELD_SELECTOR)).filter(visible);

  let best: { el: Element; label: string; score: number } | null = null;
  for (const el of fields) {
    const lbl = findFieldLabel(el);
    const s = score(label, lbl);
    if (s > 0 && (!best || s > best.score)) best = { el, label: lbl, score: s };
  }

  if (!best) {
    const sample = fields.map((el) => normalize(findFieldLabel(el))).filter(Boolean).slice(0, 20);
    return { ok: false, reason: `No input field matches "${label}".`, candidates: sample };
  }

  const el = best.el as HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });

  if ((el as HTMLElement).getAttribute("contenteditable") === "true") {
    (el as HTMLElement).innerText = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    const proto =
      input.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return { ok: true, matchedLabel: best.label.trim().slice(0, 80) };
}

export function listVisibleControls(limit = 25): { clickable: string[]; fields: string[] } {
  if (typeof document === "undefined") return { clickable: [], fields: [] };
  const main = document.querySelector("main") ?? document.body;
  const clickable = Array.from(main.querySelectorAll(CLICKABLE_SELECTOR))
    .filter(visible)
    .map((el) => normalize(elementLabel(el)))
    .filter((s) => s.length > 0 && s.length < 60);
  const fields = Array.from(main.querySelectorAll(FIELD_SELECTOR))
    .filter(visible)
    .map((el) => normalize(findFieldLabel(el)))
    .filter(Boolean);
  const dedup = (a: string[]) => Array.from(new Set(a)).slice(0, limit);
  return { clickable: dedup(clickable), fields: dedup(fields) };
}