"use client";

import { AvenzaLogo } from "@/components/AvenzaLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { OrbitLogos } from "@/components/OrbitLogos";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export function AuthFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hero-bw relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="hero-grain pointer-events-none absolute inset-0" />
        <div className="relative z-10 flex items-center justify-between gap-4">
          <AvenzaLogo
            tone="light"
            size={28}
            href="/"
            withWordmark
            wordmarkClassName="font-display text-[1.1rem] font-semibold tracking-[-0.03em]"
          />
          <LanguageSwitcher tone="light" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-md py-10">
          <OrbitLogos />
        </div>
        <div className="relative z-10 max-w-sm">
          <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-white/95">
            {t("auth.heroTitle")}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/50">{t("auth.heroLead")}</p>
        </div>
      </section>

      <section className="flex flex-col justify-center bg-paper px-6 py-12 md:px-16">
        <div className="mb-10 flex items-center justify-between gap-4 lg:hidden">
          <AvenzaLogo
            tone="dark"
            size={28}
            href="/"
            withWordmark
            wordmarkClassName="text-[1.05rem] font-semibold tracking-[-0.03em]"
          />
          <LanguageSwitcher tone="dark" />
        </div>
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.04em] text-ink">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
