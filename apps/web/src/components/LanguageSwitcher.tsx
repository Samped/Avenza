"use client";

import { LOCALES } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Tone = "light" | "dark" | "docs";

export function LanguageSwitcher({ tone = "dark" }: { tone?: Tone }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`lang-switch lang-switch--${tone}`}
      role="group"
      aria-label={t("language")}
    >
      {LOCALES.map((item) => {
        const active = locale === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`lang-switch-btn${active ? " is-active" : ""}`}
            aria-pressed={active}
            title={item.label}
            onClick={() => setLocale(item.id)}
          >
            {item.short}
          </button>
        );
      })}
    </div>
  );
}
