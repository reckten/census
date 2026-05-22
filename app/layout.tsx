import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const displayFont = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Agent Assist | Triage Console",
  description: "Ascensus internal AI-assisted support triage tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`min-h-full flex flex-col bg-[var(--ascensus-ink)] text-[var(--ascensus-text)] ${bodyFont.variable} ${displayFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
