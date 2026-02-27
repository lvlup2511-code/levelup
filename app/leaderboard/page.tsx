"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award, Globe, Users, Calendar, BarChart3, Loader2, Swords, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Scope = "global" | "friends";
type Timeframe = "all_time" | "weekly";

interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  xp_points: number;
  rank: number;
}

const DEFAULT_AVATAR = (seed: string) => `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;

function getMedalIcon(rank: number) {
  switch (rank) {
    case 1:
      return (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-[0_0_15px_rgba(251,191,36,0.5)] ring-2 ring-white/20" aria-label="Gold">
          <Trophy className="h-6 w-6" />
        </span>
      );
    case 2:
      return (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-slate-800 shadow-[0_0_12px_rgba(203,213,225,0.4)] ring-2 ring-white/20" aria-label="Silver">
          <Medal className="h-6 w-6" />
        </span>
      );
    case 3:
      return (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-700 text-amber-50 shadow-[0_0_10px_rgba(180,83,9,0.3)] ring-2 ring-white/20" aria-label="Bronze">
          <Award className="h-6 w-6" />
        </span>
      );
    default:
      return (
        <span className="flex h-10 w-10 items-center justify-center text-sm font-black text-muted-foreground/60">
          {rank}
        </span>
      );
  }
}

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("global");
  const [timeframe, setTimeframe] = useState<Timeframe>("all_time");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    let data: any[] | null = null;

    if (scope === "friends") {
      // Use the RPC for friends leaderboard
      const { data: rpcData, error } = await supabase.rpc("get_friends_leaderboard", {
        p_type: timeframe
      });
      data = rpcData;
    } else {
      // Global Leaderboard
      if (timeframe === "weekly") {
        const v_week_start = new Date();
        v_week_start.setDate(v_week_start.getDate() - (v_week_start.getDay() + 6) % 7);
        const week_start_str = v_week_start.toISOString().split('T')[0];

        const { data: weeklyData } = await supabase
          .from("weekly_xp")
          .select(`
            user_id,
            xp_earned,
            profiles(username, avatar_url)
          `)
          .eq("week_start", week_start_str)
          .order("xp_earned", { ascending: false })
          .limit(20);

        data = weeklyData?.map((w, i) => ({
          id: w.user_id,
          username: (w.profiles as any)?.username || "Anonymous",
          avatar_url: (w.profiles as any)?.avatar_url,
          xp_points: w.xp_earned,
          rank: i + 1
        })) || [];
      } else {
        const { data: globalData } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, xp_points")
          .order("xp_points", { ascending: false })
          .limit(20);

        data = globalData?.map((p, i) => ({
          id: p.id,
          username: p.username || "Anonymous",
          avatar_url: p.avatar_url,
          xp_points: p.xp_points,
          rank: i + 1
        })) || [];
      }
    }

    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [scope, timeframe]);

  const FilterButton = ({ active, onClick, icon: Icon, label }: any) => (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn(
        "flex-1 gap-2 font-black uppercase text-[10px] tracking-widest h-10 rounded-xl transition-all",
        active ? "shadow-md scale-[1.02]" : "bg-card/40 border-primary/20 hover:bg-primary/5"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 p-6 pt-8 pb-24 h-screen overflow-hidden max-w-lg mx-auto">
      <header className="mb-2">
        <h1 className="text-3xl font-black tracking-tight text-primary uppercase leading-none mb-1">
          LEADERBOARD
        </h1>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] italic opacity-70">
          The best of the best.
        </p>
      </header>

      <div className="space-y-3 shrink-0">
        <div className="flex gap-2 p-1 bg-primary/5 rounded-2xl border border-primary/10">
          <FilterButton
            active={scope === "global"}
            onClick={() => setScope("global")}
            icon={Globe}
            label="Global"
          />
          <FilterButton
            active={scope === "friends"}
            onClick={() => setScope("friends")}
            icon={Users}
            label="Friends"
          />
        </div>
        <div className="flex gap-2 p-1 bg-primary/5 rounded-2xl border border-primary/10">
          <FilterButton
            active={timeframe === "all_time"}
            onClick={() => setTimeframe("all_time")}
            icon={BarChart3}
            label="All Time"
          />
          <FilterButton
            active={timeframe === "weekly"}
            onClick={() => setTimeframe("weekly")}
            icon={Calendar}
            label="Weekly"
          />
        </div>
      </div>

      <Card className="flex-1 overflow-hidden border-2 border-primary/20 bg-card/80 shadow-lg flex flex-col">
        <CardHeader className="py-4 bg-primary/5 shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <Trophy className="h-5 w-5" />
            <span className="font-black uppercase tracking-widest text-sm">
              {scope === "global" ? "Global" : "Friends"} Ranking
            </span>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-primary/40">
              <Loader2 className="h-10 w-10 animate-spin" />
              <p className="font-bold text-xs uppercase tracking-widest">Fetching Champions...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <ShieldAlert className="h-12 w-12 text-muted-foreground/30" />
              <p className="font-bold text-sm text-muted-foreground uppercase italic leading-tight">
                {scope === "friends" ? "Invite some friends to start a competition!" : "No legends recorded yet."}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {entries.map((entry, idx) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl p-3 transition-all",
                    entry.id === currentUserId
                      ? "bg-primary/20 ring-2 ring-primary/40 shadow-md"
                      : "bg-background/40 border border-border/50 hover:bg-background/60"
                  )}
                >
                  <div className="flex w-10 items-center justify-center shrink-0">
                    {getMedalIcon(entry.rank)}
                  </div>
                  <Avatar className="h-12 w-12 border-2 border-primary/20 shrink-0">
                    <AvatarImage src={entry.avatar_url || DEFAULT_AVATAR(entry.username)} />
                    <AvatarFallback className="bg-secondary text-2xl">👦</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "font-black tracking-tight uppercase truncate leading-none mb-1",
                      entry.id === currentUserId ? "text-primary" : "text-foreground"
                    )}>
                      {entry.id === currentUserId ? "You" : entry.username}
                    </p>
                    <p className="text-[10px] font-black text-muted-foreground uppercase opacity-70">
                      {entry.xp_points.toLocaleString()} XP
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      <div className="shrink-0 flex gap-2">
        <Button
          size="lg"
          className="flex-1 gap-2 font-black h-12 uppercase rounded-2xl shadow-md transition-all active:scale-95"
          onClick={() => window.location.href = "/community"}
        >
          <Users className="h-4 w-4" />
          Find Rivals
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 aspect-square p-0 rounded-2xl border-2 border-primary/20 hover:bg-primary/5 active:scale-95"
        >
          <Swords className="h-5 w-5 text-primary" />
        </Button>
      </div>
    </div>
  );
}
