import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

function getInitials(name: string | null, id: string): string {
  if (name && name.length >= 2) return name.slice(0, 2).toUpperCase();
  return id.slice(0, 2).toUpperCase();
}

function getMedalIcon(rank: number) {
  switch (rank) {
    case 1:
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/90 text-amber-900 shadow-md" aria-label="Gold">
          <Trophy className="h-5 w-5" />
        </span>
      );
    case 2:
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300/90 text-slate-700 shadow-md" aria-label="Silver">
          <Medal className="h-5 w-5" />
        </span>
      );
    case 3:
      return (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-700/80 text-amber-100 shadow-md" aria-label="Bronze">
          <Award className="h-5 w-5" />
        </span>
      );
    default:
      return (
        <span className="flex h-9 w-9 items-center justify-center text-sm font-bold text-muted-foreground">
          {rank}
        </span>
      );
  }
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, xp_points")
    .order("xp_points", { ascending: false })
    .limit(20);

  const entries = (profiles || []).map((row, index) => ({
    id: row.id,
    name: row.username || "Anonymous",
    initials: getInitials(row.username, row.id),
    xp: row.xp_points ?? 0,
    avatar_url: row.avatar_url,
    rank: index + 1,
  }));

  const currentUserId = user?.id ?? null;

  return (
    <div className="flex flex-col gap-6 p-6 pt-8 pb-10">
      <header className="mb-2">
        <h1 className="text-3xl font-black tracking-tight text-primary uppercase">
          LEADERBOARD
        </h1>
        <p className="mt-1 text-sm font-bold text-muted-foreground uppercase tracking-widest italic opacity-70">
          Climb the ranks. The world is watching.
        </p>
      </header>

      <Card className="border-2 border-primary/20 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-primary">
            <Trophy className="h-6 w-6" aria-hidden />
            <span className="font-semibold">This Week</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No players yet. Be the first!</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-4 rounded-xl p-3 transition-colors",
                  entry.id === currentUserId
                    ? "bg-primary/15 ring-2 ring-primary/30"
                    : "bg-background/60 hover:bg-background/80"
                )}
              >
                <div className="flex w-10 items-center justify-center shrink-0">
                  {getMedalIcon(entry.rank)}
                </div>
                <Avatar className="h-11 w-11 border-2 border-border shrink-0">
                  {entry.avatar_url ? (
                    <AvatarImage src={entry.avatar_url} alt={entry.name} />
                  ) : null}
                  <AvatarFallback
                    className={cn(
                      "text-xl flex items-center justify-center h-full w-full",
                      entry.id === currentUserId ? "bg-primary/25" : "bg-secondary"
                    )}
                  >
                    👦
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "font-semibold truncate",
                      entry.id === currentUserId ? "text-primary" : "text-foreground"
                    )}
                  >
                    {entry.id === currentUserId ? "You" : entry.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {entry.xp.toLocaleString()} XP
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full gap-2 font-semibold shadow-md"
        aria-label="Challenge a friend"
      >
        <Swords className="h-5 w-5" aria-hidden />
        Challenge a Friend
      </Button>
    </div>
  );
}
