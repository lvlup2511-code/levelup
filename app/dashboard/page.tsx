import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Zap,
  Flame,
  BookOpenCheck,
  Trophy,
  Star,
  Target,
  CheckCircle2,
  Crown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";
import { getLevelFromXp, XP_PER_LEVEL } from "@/lib/gamification";

const QUESTS_TOTAL = 12;

const ACHIEVEMENTS = [
  { id: "1", title: "First Win", description: "Complete your first quest", icon: Trophy, check: (p: Profile) => (p.quests_completed ?? 0) >= 1 },
  { id: "2", title: "7-Day Streak", description: "Study 7 days in a row", icon: Flame, check: (p: Profile) => (p.highest_streak ?? 0) >= 7 },
  { id: "3", title: "Rising Star", description: "Reach Level 3", icon: Star, check: (p: Profile) => getLevelFromXp(p.xp_points).level >= 3 },
  { id: "4", title: "Halfway There", description: "Complete 6 quests", icon: Target, check: (p: Profile) => (p.quests_completed ?? 0) >= 6 },
  { id: "5", title: "Champion", description: "Reach the top of the leaderboard", icon: Crown, check: () => false },
];

function CircularLevelProgress({
  level,
  percent,
  size = 120,
  strokeWidth = 10,
}: {
  level: number;
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="hsl(var(--success))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">Lv.{level}</span>
        <span className="text-xs font-medium text-muted-foreground">{Math.round(percent)}%</span>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  const p = profile as Profile;
  const { level, xpForLevel, xpToNextLevel } = getLevelFromXp(p.xp_points);
  const xpInLevel = p.xp_points - xpForLevel;
  const xpNeededForLevel = xpToNextLevel - xpForLevel;
  const levelProgressPercent = xpNeededForLevel > 0 ? (xpInLevel / xpNeededForLevel) * 100 : 0;

  const displayName = p.username || user.email?.split("@")[0] || "Student";
  const initials = (p.username || user.email || "ST").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-6 p-6 pt-8 pb-10">
      <header className="mb-2">
        <h1 className="text-3xl font-black tracking-tight text-primary">
          DASHBOARD
        </h1>
        <p className="mt-1 text-sm font-bold text-muted-foreground uppercase tracking-widest italic opacity-70">
          Your path to mastery starts here.
        </p>
      </header>

      <Card className="border-2 border-primary/20 overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-24 w-24 border-4 border-primary/40 shadow-xl rounded-2xl overflow-hidden ring-4 ring-background">
                {p.avatar_url ? (
                  <AvatarImage src={p.avatar_url} alt={displayName} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary text-5xl">
                    👦
                  </div>
                )}
              </Avatar>
              <p className="font-semibold text-foreground">{displayName}</p>
            </div>
            <div className="flex-1 w-full space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Level {level}: {Math.round(levelProgressPercent)}% completed
                </span>
              </div>
              <Progress
                value={xpInLevel}
                max={xpNeededForLevel}
                className="h-3"
              />
              <p className="text-center text-xs text-muted-foreground">
                {xpNeededForLevel - xpInLevel} XP to Level {level + 1}
              </p>
            </div>
            <div className="hidden shrink-0 sm:block">
              <CircularLevelProgress
                level={level}
                percent={levelProgressPercent}
                size={100}
                strokeWidth={8}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-2 border-success/20 bg-card/80">
          <CardContent className="flex flex-col items-center gap-2 pt-6 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
              <Zap className="h-6 w-6 text-success" aria-hidden />
            </div>
            <span className="text-2xl font-bold text-success">
              {p.xp_points.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-muted-foreground">Total XP</span>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary/20 bg-card/80">
          <CardContent className="flex flex-col items-center gap-2 pt-6 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <Flame className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <span className="text-2xl font-bold text-foreground">
              {p.highest_streak ?? p.current_streak ?? 0}
            </span>
            <span className="text-xs font-medium text-muted-foreground">Highest Streak</span>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary/20 bg-card/80">
          <CardContent className="flex flex-col items-center gap-2 pt-6 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
              <BookOpenCheck className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <span className="text-2xl font-bold text-foreground">
              {p.quests_completed ?? 0}
              <span className="text-lg font-normal text-muted-foreground">/{QUESTS_TOTAL}</span>
            </span>
            <span className="text-xs font-medium text-muted-foreground">Quests Completed</span>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-secondary">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-foreground">
            <Trophy className="h-6 w-6 text-primary" aria-hidden />
            <span className="font-semibold">Achievements & Badges</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {ACHIEVEMENTS.map((badge) => {
              const Icon = badge.icon as LucideIcon;
              const earned = badge.check(p);
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border-2 p-4 transition-colors",
                    earned
                      ? "border-success/30 bg-success/10"
                      : "border-border bg-muted/30 opacity-75"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                      earned ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "font-semibold",
                        earned ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {badge.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{badge.description}</p>
                  </div>
                  {earned && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-success/20 bg-success/5">
        <CardContent className="flex items-center gap-4 pt-6 pb-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/20">
            <CheckCircle2 className="h-6 w-6 text-success" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-foreground">Keep it up!</p>
            <p className="text-sm text-muted-foreground">
              You&apos;re on track. Complete more quests to level up faster.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
