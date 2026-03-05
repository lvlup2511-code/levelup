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

// ────────────────────────────────────────────────────────────
// COGNITIVE LEVEL SYSTEM (12 tiers, progressive thresholds)
// ────────────────────────────────────────────────────────────

export interface CognitiveLevel {
    level: number;
    name_en: string;
    name_ar: string;
    xpRequired: number; // Total cognitive_xp needed to reach this level
}

export const COGNITIVE_LEVELS: CognitiveLevel[] = [
    { level: 1, name_en: "Beginner Thinker", name_ar: "مفكر مبتدئ", xpRequired: 0 },
    { level: 2, name_en: "Curious Explorer", name_ar: "مستكشف فضولي", xpRequired: 100 },
    { level: 3, name_en: "Active Learner", name_ar: "متعلم نشط", xpRequired: 300 },
    { level: 4, name_en: "Structured Thinker", name_ar: "مفكر منظم", xpRequired: 600 },
    { level: 5, name_en: "Analytical Mind", name_ar: "عقل تحليلي", xpRequired: 1000 },
    { level: 6, name_en: "Critical Evaluator", name_ar: "مقيّم ناقد", xpRequired: 1500 },
    { level: 7, name_en: "Strategic Reasoner", name_ar: "مفكر استراتيجي", xpRequired: 2200 },
    { level: 8, name_en: "Creative Problem Solver", name_ar: "حلّال مبدع", xpRequired: 3000 },
    { level: 9, name_en: "Advanced Synthesizer", name_ar: "مركّب متقدم", xpRequired: 4000 },
    { level: 10, name_en: "Expert Analyst", name_ar: "محلل خبير", xpRequired: 5500 },
    { level: 11, name_en: "Master Logician", name_ar: "سيد المنطق", xpRequired: 7500 },
    { level: 12, name_en: "Independent Master", name_ar: "الماجستير المستقل", xpRequired: 10000 },
];

/**
 * Get cognitive level info from cognitive XP.
 * Returns the current level, XP thresholds, and progress percentage.
 */
export function getCognitiveLevelFromXp(cognitiveXp: number) {
    let currentLevel = COGNITIVE_LEVELS[0];

    for (const lvl of COGNITIVE_LEVELS) {
        if (cognitiveXp >= lvl.xpRequired) {
            currentLevel = lvl;
        } else {
            break;
        }
    }

    const nextLevel = COGNITIVE_LEVELS.find(l => l.level === currentLevel.level + 1);
    const xpForCurrentLevel = currentLevel.xpRequired;
    const xpForNextLevel = nextLevel ? nextLevel.xpRequired : currentLevel.xpRequired;
    const xpInLevel = cognitiveXp - xpForCurrentLevel;
    const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
    const progressPercent = xpNeededForLevel > 0 ? Math.min((xpInLevel / xpNeededForLevel) * 100, 100) : 100;

    return {
        level: currentLevel.level,
        name_en: currentLevel.name_en,
        name_ar: currentLevel.name_ar,
        xpForCurrentLevel,
        xpForNextLevel,
        xpInLevel,
        xpNeededForLevel,
        progressPercent,
        isMaxLevel: currentLevel.level === 12,
    };
}

/**
 * Get cognitive level name by level number.
 */
export function getCognitiveLevelName(level: number, lang: 'en' | 'ar' = 'en'): string {
    const found = COGNITIVE_LEVELS.find(l => l.level === level);
    if (!found) return lang === 'ar' ? 'غير معروف' : 'Unknown';
    return lang === 'ar' ? found.name_ar : found.name_en;
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
