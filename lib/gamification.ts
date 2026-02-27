export const XP_PER_LEVEL = 500;
export const XP_PER_INTERACTION = 10;
export const XP_PER_IMAGE_QUEST = 25;

export interface XpAwardResult {
    newXp: number;
    previousLevel: number;
    newLevel: number;
    leveledUp: boolean;
    xpAwarded: number;
}

export function getLevelFromXp(xp: number) {
    if (xp <= 0) return { level: 1, xpForLevel: 0, xpToNextLevel: XP_PER_LEVEL };
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const xpForLevel = (level - 1) * XP_PER_LEVEL;
    const xpToNextLevel = level * XP_PER_LEVEL;
    return { level, xpForLevel, xpToNextLevel };
}

export function calculateXpAward(hasImage: boolean): number {
    return hasImage ? XP_PER_IMAGE_QUEST : XP_PER_INTERACTION;
}

export function calculateDailyStreak(lastActiveDate: string | null): {
    streakUpdate: 'increment' | 'maintain' | 'reset',
    newStreak: number
} {
    if (!lastActiveDate) {
        return { streakUpdate: 'increment', newStreak: 1 };
    }

    const lastActive = new Date(lastActiveDate);
    const today = new Date();

    // Set times to midnight for accurate day comparison
    lastActive.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffInMs = today.getTime() - lastActive.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
        return { streakUpdate: 'maintain', newStreak: -1 }; // -1 signifies no change
    } else if (diffInDays === 1) {
        return { streakUpdate: 'increment', newStreak: 1 }; // 1 signifies increment by 1
    } else {
        return { streakUpdate: 'reset', newStreak: 1 };
    }
}
