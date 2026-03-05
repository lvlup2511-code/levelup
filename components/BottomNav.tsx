"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Map,
  Trophy,
  LayoutDashboard,
  Users,
  MessageCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";

import { useLanguage } from "@/lib/contexts/LanguageContext";

const navItems = [
  { href: "/", label: "home", icon: Home },
  { href: "/levels", label: "levels", icon: Map },
  { href: "/community", label: "social", icon: Users },
  { href: "/chat", label: "chat", icon: MessageCircle },
  { href: "/dashboard", label: "profile", icon: LayoutDashboard },
  { href: "/settings", label: "settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  if (pathname === "/login" || pathname === "/onboarding") return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 w-full"
      aria-label="Bottom navigation"
    >
      <div className="mx-auto max-w-7xl px-4 relative flex h-16 items-center justify-around gap-0.5 safe-area-pb">
        {/* Notification Bell - floating above nav */}
        <div className="absolute -top-14 right-4">
          <NotificationBell />
        </div>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary bg-primary/15"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn("h-5 w-5", isActive && "animate-pulse-soft")}
                strokeWidth={isActive ? 2.5 : 2}
                aria-hidden
              />
              <span>{t(label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

