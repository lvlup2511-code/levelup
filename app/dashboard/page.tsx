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
  Brain,
  GraduationCap,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile, Badge, UserBadge } from "@/lib/supabase/types";
import {
  getLevelFromXp,
  XP_PER_LEVEL,
  getCognitiveLevelFromXp,
  getCognitiveLevelName,
  COGNITIVE_LEVELS,
} from "@/lib/gamification";

const QUESTS_TOTAL = 12;

// ── Academic Track Display ──────────────────────────────────

const TRACK_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  scientific: { label: "Scientific Track", color: "text-blue-500", bg: "bg-blue-500/10", emoji: "🔬" },
  literary: { label: "Literary Track", color: "text-amber-500", bg: "bg-amber-500/10", emoji: "📚" },
  general: { label: "General Track", color: "text-violet-500", bg: "bg-violet-500/10", emoji: "🌐" },
};

// ── Circular Progress Ring ──────────────────────────────────

function CircularProgress({
  value,
  max,
  size = 120,
  strokeWidth = 10,
  color = "hsl(var(--success))",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const percent = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - percent * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth={strokeWidth} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  color = "text-primary",
  borderColor = "border-primary/20",
}: {
  icon: any;
  value: React.ReactNode;
  label: string;
  color?: string;
  borderColor?: string;
}) {
  return (
    <Card className={cn("border-2 bg-card/80", borderColor)}>
      <CardContent className="flex flex-col items-center gap-2 pt-6 pb-6">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-full", color.replace("text-", "bg-").replace("500", "500/20"))}>
          <Icon className={cn("h-6 w-6", color)} aria-hidden />
        </div>
        <span className={cn("text-2xl font-bold", color === "text-success" ? color : "text-foreground")}>
          {value}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  // Fetch all badges + user's earned badges
  const { data: allBadges } = await supabase
    .from("badges")
    .select("*")
    .order("xp_threshold", { ascending: true, nullsFirst: false });

  const { data: userBadgeRows } = await supabase
    .from("user_badges")
    .select("badge_id, earned_at")
    .eq("user_id", user.id);

  const earnedBadgeIds = new Set((userBadgeRows || []).map((ub: any) => ub.badge_id));

  const p = profile as Profile;

  // ── XP Level (existing system) ─────────────────────────
  const { level, xpForLevel, xpToNextLevel } = getLevelFromXp(p.xp_points);
  const xpInLevel = p.xp_points - xpForLevel;
  const xpNeededForLevel = xpToNextLevel - xpForLevel;
  const levelProgressPercent = xpNeededForLevel > 0 ? (xpInLevel / xpNeededForLevel) * 100 : 0;

  // ── Cognitive Level ────────────────────────────────────
  const cogInfo = getCognitiveLevelFromXp(p.cognitive_xp);

  const displayName = p.username || user.email?.split("@")[0] || "Student";
  const trackConfig = p.academic_track ? TRACK_CONFIG[p.academic_track] : null;

  return (
    <div className="flex flex-col gap-6 p-6 pt-8 pb-28">
      <header className="mb-2">
        <h1 className="text-3xl font-black tracking-tight text-primary">
          DASHBOARD
        </h1>
        <p className="mt-1 text-sm font-bold text-muted-foreground uppercase tracking-widest italic opacity-70">
          Your path to mastery starts here.
        </p>
      </header>

      {/* ═══════════════════════════════════════════════════════
           HERO: Cognitive Level Card
           ═══════════════════════════════════════════════════════ */}
      <Card className="border-2 border-violet-500/20 overflow-hidden bg-gradient-to-br from-violet-500/5 via-transparent to-blue-500/5">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            {/* Avatar + Name + Track */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-violet-500/40 shadow-xl rounded-2xl overflow-hidden ring-4 ring-background">
                  {p.avatar_url ? (
                    <AvatarImage src={p.avatar_url} alt={displayName} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-secondary text-5xl">
                      👦
                    </div>
                  )}
                </Avatar>
                {/* Level badge on avatar */}
                <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white shadow-lg border-2 border-background">
                  {cogInfo.level}
                </span>
              </div>
              <div className="text-center">
                <p className="font-black text-foreground text-lg uppercase tracking-tight">{displayName}</p>
                {trackConfig && (
                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1", trackConfig.bg, trackConfig.color)}>
                    {trackConfig.emoji} {trackConfig.label}
                  </span>
                )}
              </div>
            </div>

            {/* Cognitive Level Info */}
            <div className="flex-1 w-full space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
                  <Brain className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cognitive Level</p>
                  <p className="text-lg font-black text-foreground tracking-tight">
                    Level {cogInfo.level}: <span className="text-violet-500">{cogInfo.name_en}</span>
                  </p>
                </div>
              </div>

              {/* Cognitive XP Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {p.cognitive_xp.toLocaleString()} / {cogInfo.xpForNextLevel.toLocaleString()} CXP
                  </span>
                  <span className="text-xs font-bold text-violet-500">
                    {Math.round(cogInfo.progressPercent)}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500 transition-all duration-700 ease-out"
                    style={{ width: `${cogInfo.progressPercent}%` }}
                  />
                </div>
                {!cogInfo.isMaxLevel && (
                  <p className="text-[10px] text-muted-foreground text-center font-medium">
                    {cogInfo.xpNeededForLevel - cogInfo.xpInLevel} CXP to Level {cogInfo.level + 1}: {getCognitiveLevelName(cogInfo.level + 1)}
                  </p>
                )}
              </div>
            </div>

            {/* Circular Progress (desktop) */}
            <div className="hidden shrink-0 sm:block">
              <CircularProgress
                value={cogInfo.xpInLevel}
                max={cogInfo.xpNeededForLevel}
                size={100}
                strokeWidth={8}
                color="hsl(262, 83%, 58%)"
              >
                <span className="text-xl font-black text-violet-500">Lv.{cogInfo.level}</span>
                <span className="text-[10px] font-bold text-muted-foreground">{Math.round(cogInfo.progressPercent)}%</span>
              </CircularProgress>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
           STATS ROW
           ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Zap}
          value={p.xp_points.toLocaleString()}
          label="Total XP"
          color="text-success"
          borderColor="border-success/20"
        />
        <StatCard
          icon={Brain}
          value={p.cognitive_xp.toLocaleString()}
          label="Cognitive XP"
          color="text-violet-500"
          borderColor="border-violet-500/20"
        />
        <StatCard
          icon={Flame}
          value={p.highest_streak ?? p.current_streak ?? 0}
          label="Best Streak"
          color="text-orange-500"
          borderColor="border-orange-500/20"
        />
        <StatCard
          icon={BookOpenCheck}
          value={<>{p.quests_completed ?? 0}<span className="text-lg font-normal text-muted-foreground">/{QUESTS_TOTAL}</span></>}
          label="Quests Done"
          color="text-primary"
          borderColor="border-primary/20"
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
           XP LEVEL PROGRESS (compact)
           ═══════════════════════════════════════════════════════ */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Game Level {level}
                </span>
                <span className="text-xs font-bold text-primary">
                  {p.xp_points.toLocaleString()} XP
                </span>
              </div>
              <Progress value={xpInLevel} max={xpNeededForLevel} className="h-2" />
              <p className="text-[10px] text-muted-foreground font-medium">
                {xpNeededForLevel - xpInLevel} XP to Level {level + 1}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
           BADGES GRID
           ═══════════════════════════════════════════════════════ */}
      <Card className="border-2 border-secondary">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground">
              <Trophy className="h-6 w-6 text-primary" aria-hidden />
              <span className="font-black uppercase tracking-tight">Badges & Achievements</span>
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              {earnedBadgeIds.size}/{(allBadges || []).length}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(allBadges || []).map((badge: Badge) => {
              const earned = earnedBadgeIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all",
                    earned
                      ? "border-success/30 bg-success/5 shadow-sm"
                      : "border-border bg-muted/20 opacity-60"
                  )}
                >
                  {/* Badge Emoji */}
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl text-2xl",
                    earned ? "bg-success/15" : "bg-muted/50"
                  )}>
                    {earned ? badge.emoji : <Lock className="h-5 w-5 text-muted-foreground" />}
                  </div>

                  {/* Title */}
                  <p className={cn(
                    "text-xs font-black uppercase tracking-tight leading-tight",
                    earned ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {badge.title_en}
                  </p>

                  {/* Description */}
                  <p className="text-[9px] text-muted-foreground leading-snug line-clamp-2">
                    {badge.description_en}
                  </p>

                  {/* Earned check */}
                  {earned && (
                    <div className="absolute -top-1.5 -right-1.5">
                      <CheckCircle2 className="h-5 w-5 text-success fill-background" />
                    </div>
                  )}

                  {/* XP threshold hint */}
                  {!earned && badge.xp_threshold && (
                    <span className="text-[8px] font-bold text-muted-foreground/60 uppercase">
                      {badge.xp_threshold} CXP
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════
           MOTIVATIONAL FOOTER
           ═══════════════════════════════════════════════════════ */}
      <Card className="border-2 border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-blue-500/5">
        <CardContent className="flex items-center gap-4 pt-6 pb-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15">
            <Sparkles className="h-6 w-6 text-violet-500" aria-hidden />
          </div>
          <div>
            <p className="font-black text-foreground uppercase tracking-tight text-sm">
              {cogInfo.level < 4 ? "Keep thinking!" : cogInfo.level < 8 ? "Sharp mind!" : "Almost a master!"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cogInfo.level < 4
                ? "Use the Think Engine to develop your cognitive skills and unlock badges."
                : cogInfo.level < 8
                  ? "Your analytical skills are growing. Push for the next cognitive level!"
                  : "You're in the top tier. Keep challenging yourself to reach Independent Master."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
