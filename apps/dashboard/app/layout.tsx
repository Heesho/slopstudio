import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "slopstudio",
  description:
    "Local-first folder for AI video making — Claude Code + Higgsfield",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-neutral-950 text-neutral-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
