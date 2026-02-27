import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 pt-8 pb-10">
      <header className="animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-secondary" />
        <div className="mt-2 h-4 w-64 rounded bg-secondary/70" />
      </header>
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            <div className="h-20 w-20 shrink-0 rounded-full bg-secondary" />
            <div className="h-3 flex-1 rounded-full bg-secondary" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-2 border-border">
            <CardContent className="flex flex-col items-center gap-2 pt-6 pb-6">
              <div className="h-12 w-12 rounded-full bg-secondary" />
              <div className="h-8 w-16 rounded bg-secondary" />
              <div className="h-4 w-24 rounded bg-secondary/70" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="h-4 w-40 rounded bg-secondary mb-4" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 rounded-xl border-2 border-border p-4">
                <div className="h-12 w-12 shrink-0 rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-secondary" />
                  <div className="h-3 w-32 rounded bg-secondary/70" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
