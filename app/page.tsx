import Link from "next/link";
import { Flame, Zap, BookOpen, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import DailyMissionsWidget from "@/components/DailyMissionsWidget";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const streak = profile?.current_streak ?? 0;
  const xp = (profile?.xp_points ?? 0).toLocaleString();
  const quests = profile?.quests_completed ?? 0;
  const coins = (profile?.coins ?? 0).toLocaleString();

  return (
    <div className="flex flex-col gap-6 p-6 pt-8 max-w-7xl mx-auto pb-24 w-full">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight text-primary">
          LevelUp
        </h1>
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-1.5 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20 text-yellow-700 font-bold text-sm">
              <Coins className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              {coins}
            </div>
          )}
          {user ? (
            <div className="text-[10px] font-bold bg-primary/10 px-2 py-1 rounded-full text-primary uppercase">
              {profile?.username || user.email?.split("@")[0]}
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Card className="overflow-hidden border-2 border-primary/20 bg-card/80 shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <div className="flex items-center gap-2 text-success">
              <Flame className="h-4 w-4" aria-hidden />
              <span className="text-sm font-bold uppercase tracking-tighter">Streak</span>
            </div>
          </CardHeader>
          <CardContent className="flex items-baseline gap-1 pb-4">
            <span className="text-3xl font-black text-success tracking-tighter">{streak}</span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase">Days</span>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-2 border-primary/20 bg-card/80 shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <div className="flex items-center gap-2 text-primary">
              <Zap className="h-4 w-4" aria-hidden />
              <span className="text-sm font-bold uppercase tracking-tighter">Total XP</span>
            </div>
          </CardHeader>
          <CardContent className="flex items-baseline gap-1 pb-4">
            <span className="text-3xl font-black text-primary tracking-tighter">{xp}</span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase">XP</span>
          </CardContent>
        </Card>
      </div>

      {/* 🎯 Daily Missions Widget */}
      {user && <DailyMissionsWidget />}

      <div className="pt-2">
        <Link href="/quest" className="block">
          <Button
            size="lg"
            className="w-full h-14 text-lg font-black shadow-[0_4px_0_0_rgba(14,165,233,0.4)] transition-all active:translate-y-[2px] active:shadow-none hover:scale-[1.01]"
          >
            CONTINUE QUEST
          </Button>
        </Link>
      </div>

      <div className="flex justify-center">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Next Level in 340 XP</p>
      </div>
    </div>
  );
}
