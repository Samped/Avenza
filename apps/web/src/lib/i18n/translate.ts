import { dictionaries, type Locale } from "./dictionaries";

/** Resolve dotted keys with English fallback. */
export function translate(locale: Locale, key: string): string {
  const walk = (root: unknown, parts: string[]): string | undefined => {
    let cur: unknown = root;
    for (const p of parts) {
      if (!cur || typeof cur !== "object" || !(p in (cur as object))) return undefined;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : undefined;
  };
  const parts = key.split(".");
  return walk(dictionaries[locale], parts) ?? walk(dictionaries.en, parts) ?? key;
}
