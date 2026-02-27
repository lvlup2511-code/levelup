"use client";

import { LEVELS, getLevelTypeLabel, type Level } from "@/config/gameData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 140;
const PATH_WIDTH = 56;
const NODE_SIZE = 48;

const NODE_CENTER_LEFT = 24;
const NODE_CENTER_RIGHT = 32;

function PathSvg({ totalRows }: { totalRows: number }) {
  const height = totalRows * ROW_HEIGHT;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < totalRows; i++) {
    const x = i % 2 === 0 ? NODE_CENTER_LEFT : NODE_CENTER_RIGHT;
    const y = i * ROW_HEIGHT + ROW_HEIGHT / 2;
    points.push({ x, y });
  }
  const pathD = points
    .reduce(
      (acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`),
      ""
    )
    .trim();

  return (
    <svg
      className="absolute left-0 top-0 h-full w-full overflow-visible"
      width={PATH_WIDTH}
      height={height}
      aria-hidden
    >
      <defs>
        <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
          <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke="url(#pathGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="8 6"
        className="animate-[path-pulse_3s_ease-in-out_infinite]"
      />
    </svg>
  );
}

function LevelNode({
  level,
  index,
  isLeft,
}: {
  level: Level;
  index: number;
  isLeft: boolean;
}) {
  const unlocked = level.isUnlocked;
  const typeStyles = {
    intro: "bg-primary/20 text-primary border-primary/40",
    practice: "bg-foreground/10 text-foreground border-foreground/20",
    challenge: "bg-success/20 text-success border-success/40",
  };
  const lockedStyles = "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={cn(
        "absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-md transition-all duration-300",
        isLeft ? "left-0" : "right-0",
        unlocked
          ? cn(
              "cursor-pointer hover:scale-110 hover:shadow-lg active:scale-105",
              typeStyles[level.type]
            )
          : cn("cursor-not-allowed", lockedStyles)
      )}
      style={{ width: NODE_SIZE, height: NODE_SIZE }}
      aria-hidden
    >
      {unlocked ? (
        <span className="text-sm font-bold">{level.id}</span>
      ) : (
        <Lock className="h-5 w-5" aria-hidden />
      )}
    </div>
  );
}

function LevelRow({
  level,
  index,
}: {
  level: Level;
  index: number;
}) {
  const isLeft = index % 2 === 0;
  const unlocked = level.isUnlocked;
  const typeStyles = {
    intro: "bg-primary/15 border-primary/30 text-primary",
    practice: "bg-foreground/5 border-foreground/20 text-foreground",
    challenge: "bg-success/15 border-success/30 text-success",
  };

  return (
    <div
      className="relative flex w-full items-stretch gap-0"
      style={{ minHeight: ROW_HEIGHT }}
    >
      {/* Left content area */}
      <div className="flex flex-1 items-center justify-end pr-2">
        {!isLeft && (
          <LevelCard level={level} unlocked={unlocked} typeStyles={typeStyles} />
        )}
      </div>

      {/* Central path column with node */}
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ width: PATH_WIDTH }}
      >
        <LevelNode level={level} index={index} isLeft={isLeft} />
      </div>

      {/* Right content area */}
      <div className="flex flex-1 items-center justify-start pl-2">
        {isLeft && (
          <LevelCard level={level} unlocked={unlocked} typeStyles={typeStyles} />
        )}
      </div>
    </div>
  );
}

function LevelCard({
  level,
  unlocked,
  typeStyles,
}: {
  level: Level;
  unlocked: boolean;
  typeStyles: Record<string, string>;
}) {
  return (
    <Card
      className={cn(
        "w-full max-w-[280px] transition-all duration-300 sm:max-w-[320px]",
        unlocked
          ? "border-2 shadow-sm hover:scale-[1.02] hover:shadow-md active:scale-[0.99]"
          : "cursor-not-allowed opacity-80 pointer-events-none select-none"
      )}
      aria-disabled={!unlocked}
    >
      <CardContent className="p-4">
        <span
          className={cn(
            "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
            unlocked ? typeStyles[level.type] : "bg-muted text-muted-foreground"
          )}
        >
          {getLevelTypeLabel(level.type)}
        </span>
        <h3
          className={cn(
            "mt-2 font-semibold leading-tight",
            unlocked ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {level.title}
        </h3>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm font-medium",
              unlocked ? "text-success" : "text-muted-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            +{level.xpReward} XP
          </span>
          {unlocked && (
            <Button
              size="sm"
              className="gap-1 font-semibold shadow-sm"
              aria-label={`Start quest: ${level.title}`}
            >
              Start Quest
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function LevelsPage() {
  return (
    <div className="flex flex-col gap-6 p-6 pt-8 pb-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Level Map
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete levels to unlock the next. Earn XP and level up!
        </p>
      </header>

      <div className="relative mx-auto w-full max-w-lg">
        {/* Winding path SVG behind nodes */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: PATH_WIDTH, height: LEVELS.length * ROW_HEIGHT }}
        >
          <PathSvg totalRows={LEVELS.length} />
        </div>

        {/* Level rows */}
        <div className="relative flex flex-col">
          {LEVELS.map((level, index) => (
            <LevelRow key={level.id} level={level} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
