import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import Header from "./components/Header";
import { readDna, readState } from "@/lib/content";

export const metadata: Metadata = {
  title: "Cambria",
  description: "Local dashboard for AI-generated docuseries built with Claude Code + Higgsfield",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dna = await readDna().catch(() => null);
  const state = await readState();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-neutral-950 text-neutral-100 min-h-screen antialiased">
        <Header title={dna?.title ?? "Cambria"} state={state} />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
