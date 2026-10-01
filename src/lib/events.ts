/** Tiny app-wide event bus for moments that cross component trees. */

type CelebrateDetail = { x?: number; y?: number; colors?: string[] };

const target = new EventTarget();

export function celebrate(detail: CelebrateDetail = {}) {
  target.dispatchEvent(new CustomEvent('celebrate', { detail }));
}

export function onCelebrate(fn: (d: CelebrateDetail) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<CelebrateDetail>).detail);
  target.addEventListener('celebrate', handler);
  return () => target.removeEventListener('celebrate', handler);
}

/** Remembers the last pointer position so celebrations burst where you clicked. */
export const pointer = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    },
    { capture: true, passive: true },
  );
}

/** Per-viewer conveniences only (theme, last view). Never app data. */
export const prefs = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = window.localStorage.getItem(`workfile:pref:${key}`);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      window.localStorage.setItem(`workfile:pref:${key}`, JSON.stringify(value));
    } catch {
      /* storage blocked: preference lasts for this visit only */
    }
  },
};
