import { Source_Sans_3, Source_Serif_4 } from "next/font/google";

const docsSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-docs-sans",
  weight: ["400", "500", "600", "700"],
});

const docsSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-docs-serif",
  weight: ["400", "600", "700"],
});

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <div className={`docs-root ${docsSans.variable} ${docsSerif.variable}`}>{children}</div>;
}
