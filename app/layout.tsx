import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "LevelUp — Gamified Learning",
  description: "Level up your skills with quests, XP, and friendly competition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <main className="min-h-screen pb-20 md:pb-24 md:max-w-lg md:mx-auto md:border-x md:border-border">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
