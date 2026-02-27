import Link from "next/link";
import { Flame, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="flex flex-col gap-6 p-6 pt-8 max-w-lg mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight text-primary">
          LevelUp
        </h1>
        {user ? (
          <div className="text-xs font-bold bg-primary/10 px-3 py-1 rounded-full text-primary">
            Signed in as {profile?.username || user.email?.split("@")[0]}
          </div>
        ) : (
          <Link href="/login" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10">
            Sign in
          </Link>
        )}
      </header>

      <Card className="overflow-hidden border-2 border-primary/20 bg-card/80 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-success">
            <Flame className="h-6 w-6" aria-hidden />
            <span className="text-lg font-bold">Daily Streak</span>
          </div>
        </CardHeader>
        <CardContent className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-success tracking-tighter">{streak}</span>
          <span className="text-muted-foreground font-medium">days in a row</span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border shadow-none">
          <CardContent className="flex flex-col items-center gap-1 pt-6 pb-6 text-center">
            <Zap className="h-8 w-8 text-primary mb-1" aria-hidden />
            <span className="text-2xl font-black text-foreground">{xp}</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total XP</span>
          </CardContent>
        </Card>
        <Card className="border shadow-none">
          <CardContent className="flex flex-col items-center gap-1 pt-6 pb-6 text-center">
            <BookOpen className="h-8 w-8 text-primary mb-1" aria-hidden />
            <span className="text-2xl font-black text-foreground">{quests}</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quests Done</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 pt-4">
        <Link href="/quest" className="block">
          <Button
            size="lg"
            className="w-full h-14 text-lg font-black shadow-[0_4px_0_0_rgba(14,165,233,0.4)] transition-all active:translate-y-[2px] active:shadow-none hover:scale-[1.01]"
          >
            CONTINUE QUEST
          </Button>
        </Link>
      </div>
    </div>
  );
}
