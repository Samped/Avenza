import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DM_Sans, Syne, IBM_Plex_Mono } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { isLocale, LOCALE_STORAGE_KEY, type Locale } from "@/lib/i18n/dictionaries";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AVENZA",
  description: "Programmable B2B payments and financial operations infrastructure",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

async function readLocaleCookie(): Promise<Locale> {
  const jar = await cookies();
  const raw = jar.get(LOCALE_STORAGE_KEY)?.value;
  return isLocale(raw) ? raw : "en";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialLocale = await readLocaleCookie();

  return (
    <html
      lang={initialLocale === "zh" ? "zh-CN" : "en"}
      data-locale={initialLocale}
      suppressHydrationWarning
    >
      <head>
        {/* Runtime stylesheet — avoids next/font Google fetch failures at build time */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
        />
      </head>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} font-sans antialiased`}>
        <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
