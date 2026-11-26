"use client";

import Link from "next/link";
import { AvenzaLogo } from "@/components/AvenzaLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { OrbitLogos } from "@/components/OrbitLogos";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function HomePage() {
  const { t } = useI18n();

  return (
    <main className="hero-bw relative min-h-screen overflow-hidden text-white">
      <div className="hero-grain pointer-events-none absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-10 pt-7 md:px-10">
        <header className="flex items-center justify-between animate-rise">
          <AvenzaLogo
            tone="light"
            size={28}
            href={null}
            withWordmark
            wordmarkClassName="text-[1.05rem] font-semibold tracking-[-0.03em]"
          />
          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher tone="light" />
            <Link href="/docs" className="px-3 py-2 text-sm text-white/55 transition hover:text-white">
              {t("chrome.docs")}
            </Link>
            <Link href="/login" className="px-3 py-2 text-sm text-white/55 transition hover:text-white">
              {t("chrome.signIn")}
            </Link>
            <Link
              href="/register"
              className="bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
            >
              {t("chrome.createAccount")}
            </Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-0">
          <div className="max-w-xl">
            <p className="font-display text-[clamp(2rem,4.5vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.035em] animate-rise">
              {t("brand")}
            </p>
            <h1 className="mt-6 text-[1.25rem] font-medium leading-snug tracking-[-0.02em] text-white/88 md:text-[1.45rem] animate-rise-late">
              {t("landing.headline")}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/48 animate-rise-later">
              {t("landing.lead")}
            </p>
            <div className="mt-10 flex flex-wrap gap-3 animate-rise-later">
              <Link href="/register" className="btn-light btn-lg">
                {t("chrome.getStarted")}
              </Link>
              <Link href="/login" className="btn-invert btn-lg">
                {t("chrome.signIn")}
              </Link>
            </div>
          </div>

          <div className="animate-rise-later">
            <OrbitLogos />
          </div>
        </section>

        <footer className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/10 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
          <span>{t("landing.nativeUsdc")}</span>
          <span>{t("landing.xlayer")}</span>
          <span>{t("landing.tapeout")}</span>
          <span className="ml-auto text-white/20">{t("landing.footer")}</span>
        </footer>
      </div>
    </main>
  );
}
