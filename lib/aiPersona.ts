import { EducationStage } from "./supabase/types";

export interface Persona {
    label: string;
    behavior: string;
}

export function getGamificationPersona(level: number): Persona {
    if (level <= 3) {
        return {
            label: "Beginner (Friendly Guide)",
            behavior: "Use very simple Arabic. Act as a patient, friendly guide. Focus on foundational concepts. Use encouraging analogies. If they are stuck, give them a hint but don't solve it entirely.",
        };
    } else if (level >= 7) {
        return {
            label: "Advanced (The Challenger)",
            behavior: "Be a 'Challenger'. Use complex, academic terminology. Ask deep follow-up questions to verify their mental model of the concept. Don't accept surface-level answers; push them to explain the 'why'.",
        };
    } else {
        return {
            label: "Intermediate (Tutor)",
            behavior: "Balance support with challenge. Use standard terminology and ask conceptual questions. Help them bridge the gap between basics and advanced topics.",
        };
    }
}

export function getEducationContext(stage: EducationStage | null, grade: number | null) {
    const stageMap: Record<EducationStage, { label: string; rules: string }> = {
        primary: {
            label: "المرحلة الابتدائية",
            rules: "Style: Playful, fun, and extremely encouraging. Use many emojis (🌟, 🎈, ✨). Use very simple, short sentences in Arabic. Tell short stories or use game analogies. Treat the student like a younger sibling.",
        },
        preparatory: {
            label: "المرحلة الإعدادية",
            rules: "Style: Approachable and supportive. Use standard Arabic terminology. Bridge the gap between fun and academic. Use clear examples related to their school curriculum.",
        },
        secondary: {
            label: "المرحلة الثانوية",
            rules: "Style: Professional, academic, and serious. Use formal, technical terminology. Treat them as adult learners. Focus on curriculum standards and prepare them for higher exams (Thanaweya Amma). Use a mentorship tone.",
        },
    };

    const defaultContext = {
        label: "Student",
        rules: "Style: Friendly and educational. Use clear Arabic.",
    };

    return stage ? stageMap[stage] : defaultContext;
}
