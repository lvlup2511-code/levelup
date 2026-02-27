import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LeaderboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 pt-8 pb-10">
      <header className="animate-pulse">
        <div className="h-8 w-40 rounded-lg bg-secondary" />
        <div className="mt-2 h-4 w-56 rounded bg-secondary/70" />
      </header>
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-2">
          <div className="h-6 w-32 rounded bg-secondary" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-background/60 p-3"
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-secondary" />
              <div className="h-11 w-11 shrink-0 rounded-full bg-secondary" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 rounded bg-secondary" />
                <div className="h-3 w-16 rounded bg-secondary/70" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="h-11 w-full rounded-lg bg-secondary" />
    </div>
  );
}
