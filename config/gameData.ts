/**
 * LevelUp — Single source of truth for game/level data.
 * Types: 1–3 Intro, 4–6 Practice, 7–12 Challenge
 */

export type LevelType = "intro" | "practice" | "challenge";

export interface Level {
  id: number;
  title: string;
  type: LevelType;
  xpReward: number;
  isUnlocked: boolean;
}

export const LEVELS: Level[] = [
  { id: 1, title: "Welcome to LevelUp", type: "intro", xpReward: 50, isUnlocked: true },
  { id: 2, title: "Your First Quest", type: "intro", xpReward: 75, isUnlocked: true },
  { id: 3, title: "Understanding XP", type: "intro", xpReward: 100, isUnlocked: true },
  { id: 4, title: "Practice Basics", type: "practice", xpReward: 120, isUnlocked: true },
  { id: 5, title: "Skill Builder", type: "practice", xpReward: 150, isUnlocked: true },
  { id: 6, title: "Level Up Your Knowledge", type: "practice", xpReward: 175, isUnlocked: false },
  { id: 7, title: "Challenge: Speed Round", type: "challenge", xpReward: 200, isUnlocked: false },
  { id: 8, title: "Challenge: Master Mode", type: "challenge", xpReward: 225, isUnlocked: false },
  { id: 9, title: "Challenge: Expert Path", type: "challenge", xpReward: 250, isUnlocked: false },
  { id: 10, title: "Challenge: Legend Quest", type: "challenge", xpReward: 300, isUnlocked: false },
  { id: 11, title: "Challenge: Ultimate Test", type: "challenge", xpReward: 350, isUnlocked: false },
  { id: 12, title: "Grand Champion", type: "challenge", xpReward: 500, isUnlocked: false },
];

export function getLevelTypeLabel(type: LevelType): string {
  switch (type) {
    case "intro":
      return "Intro";
    case "practice":
      return "Practice";
    case "challenge":
      return "Challenge";
    default:
      return type;
  }
}
