import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getCognitiveLevelFromXp, getCognitiveLevelName } from "@/lib/gamification";
import type { ThinkingCategory } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

// ────────────────────────────────────────────────────────────
// THINKING CATEGORIES & POINT WEIGHTS
// ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ThinkingCategory, { en: string; ar: string }> = {
    logical_analysis: { en: "Logical Analysis", ar: "التحليل المنطقي" },
    deduction: { en: "Deduction", ar: "الاستنتاج" },
    critique: { en: "Critique", ar: "النقد والتقييم" },
    problem_solving: { en: "Problem Solving", ar: "حل المشكلات" },
};

// ────────────────────────────────────────────────────────────
// SOCRATIC SYSTEM PROMPT
// ────────────────────────────────────────────────────────────

function getThinkEngineSystemPrompt(
    cognitiveLevel: number,
    levelName: string,
    academicTrack: string | null,
    username: string
): string {
    const trackContext = academicTrack
        ? `Their academic track is "${academicTrack}". Tailor examples to this track when possible.`
        : "Their academic track has not been set yet.";

    let difficultyGuidance: string;
    if (cognitiveLevel <= 3) {
        difficultyGuidance = `This student is at a BEGINNER level. Use very simple language. Ask ONE guiding question at a time. Be patient and highly encouraging. Use relatable real-world analogies. If they struggle after 2 hints, provide a more direct scaffold but still don't give the final answer.`;
    } else if (cognitiveLevel <= 6) {
        difficultyGuidance = `This student is at an INTERMEDIATE level. Use standard terminology. Ask 1-2 guiding questions. Challenge them to explain their reasoning. Introduce connections between concepts. Accept partially correct answers and build on them.`;
    } else if (cognitiveLevel <= 9) {
        difficultyGuidance = `This student is at an ADVANCED level. Use academic terminology. Ask deeper "why" and "what if" questions. Push them to consider edge cases, counterexamples, and alternative approaches. Don't accept surface-level answers.`;
    } else {
        difficultyGuidance = `This student is at a MASTERY level. Treat them as a near-peer. Ask challenging questions that require synthesis across multiple concepts. Encourage them to teach back, identify assumptions, and propose original solutions.`;
    }

    return `You are the LevelUp Think Engine — a Socratic AI tutor designed to develop critical thinking in high school students.

═══════════════════════════════════════════
STUDENT CONTEXT
═══════════════════════════════════════════
Name: ${username}
Cognitive Level: ${cognitiveLevel}/12 — "${levelName}"
${trackContext}

═══════════════════════════════════════════
CORE RULES (NEVER VIOLATE)
═══════════════════════════════════════════

1. **NEVER give the direct answer immediately.** Your job is to GUIDE, not to SOLVE.
2. **Categorize every question** into one of these thinking types:
   - "logical_analysis" — Breaking down complex information into components
   - "deduction" — Drawing conclusions from given premises
   - "critique" — Evaluating arguments, evidence, or methods
   - "problem_solving" — Finding solutions through systematic approaches
3. **Use the Socratic method:** Ask probing questions that lead the student to discover the answer themselves.
4. **Evaluate their WAY OF THINKING**, not just correctness. Award points for:
   - patience (taking time to think through steps): 0-5 points
   - logicalSteps (following a logical chain of reasoning): 0-5 points
   - deduction (making valid inferences from information): 0-5 points

═══════════════════════════════════════════
DIFFICULTY CALIBRATION
═══════════════════════════════════════════
${difficultyGuidance}

═══════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════

You MUST end every response with a JSON block wrapped in <think_eval> tags.
This block is REQUIRED and must ALWAYS be present.

Example:
<think_eval>
{
  "thinkingCategory": "logical_analysis",
  "cognitivePoints": {
    "patience": 3,
    "logicalSteps": 4,
    "deduction": 2
  },
  "feedback": "Good attempt at breaking down the problem. Try to identify the key variables first."
}
</think_eval>

IMPORTANT:
- The text BEFORE the <think_eval> block is your Socratic response (the conversation with the student).
- The <think_eval> block contains the structured evaluation.
- ALWAYS include the <think_eval> block, even on the first message.
- For the first message when you're just receiving the question, set points to 0 and provide initial guidance.
- Respond primarily in Arabic if the student writes in Arabic, otherwise respond in the language they use.
- Keep your Socratic responses concise — 2-4 paragraphs max.`;
}

// ────────────────────────────────────────────────────────────
// PARSE THE STRUCTURED <think_eval> BLOCK
// ────────────────────────────────────────────────────────────

interface ThinkEvaluation {
    thinkingCategory: ThinkingCategory;
    cognitivePoints: {
        patience: number;
        logicalSteps: number;
        deduction: number;
    };
    feedback: string;
}

function parseThinkEval(text: string): { reply: string; evaluation: ThinkEvaluation | null } {
    const evalMatch = text.match(/<think_eval>\s*([\s\S]*?)\s*<\/think_eval>/);

    if (!evalMatch) {
        return { reply: text.trim(), evaluation: null };
    }

    const reply = text.replace(/<think_eval>[\s\S]*?<\/think_eval>/, "").trim();

    try {
        const parsed = JSON.parse(evalMatch[1]);
        const evaluation: ThinkEvaluation = {
            thinkingCategory: parsed.thinkingCategory || "logical_analysis",
            cognitivePoints: {
                patience: Math.min(Math.max(parsed.cognitivePoints?.patience || 0, 0), 5),
                logicalSteps: Math.min(Math.max(parsed.cognitivePoints?.logicalSteps || 0, 0), 5),
                deduction: Math.min(Math.max(parsed.cognitivePoints?.deduction || 0, 0), 5),
            },
            feedback: parsed.feedback || "",
        };
        return { reply, evaluation };
    } catch {
        return { reply, evaluation: null };
    }
}

// ────────────────────────────────────────────────────────────
// REQUEST / RESPONSE TYPES
// ────────────────────────────────────────────────────────────

export type ThinkEngineMessage = { role: "user" | "assistant"; content: string };

export type ThinkEngineRequestBody = {
    messages: ThinkEngineMessage[];
    image?: string;
};

export type ThinkEngineResponseBody = {
    reply: string;
    thinkingCategory: ThinkingCategory | null;
    cognitivePoints: {
        patience: number;
        logicalSteps: number;
        deduction: number;
    } | null;
    feedback: string | null;
    totalXpAwarded: number;
    newCognitiveXp: number;
    newCognitiveLevel: number;
    cognitiveLeveUp: boolean;
    error?: string;
    rateLimited?: boolean;
};

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function parseImageDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1].trim(), data: match[2].trim() };
}

function buildGeminiHistory(messages: ThinkEngineMessage[]): Content[] {
    const firstUserIndex = messages.findIndex((m) => m.role === "user");
    if (firstUserIndex === -1) return [];
    const cleaned = messages.slice(firstUserIndex);
    return cleaned.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }] as Part[],
    }));
}

// ────────────────────────────────────────────────────────────
// POST HANDLER
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<ThinkEngineResponseBody>> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { reply: "", error: "Missing API Key", thinkingCategory: null, cognitivePoints: null, feedback: null, totalXpAwarded: 0, newCognitiveXp: 0, newCognitiveLevel: 1, cognitiveLeveUp: false },
            { status: 500 }
        );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json(
            { reply: "", error: "Unauthorized", thinkingCategory: null, cognitivePoints: null, feedback: null, totalXpAwarded: 0, newCognitiveXp: 0, newCognitiveLevel: 1, cognitiveLeveUp: false },
            { status: 401 }
        );
    }

    // ── Fetch profile ─────────────────────────────────────────
    const { data: profile } = await supabase
        .from("profiles")
        .select("username, cognitive_level, cognitive_xp, academic_track")
        .eq("id", user.id)
        .single();

    const cognitiveXp = profile?.cognitive_xp ?? 0;
    const cognitiveLevel = profile?.cognitive_level ?? 1;
    const academicTrack = profile?.academic_track ?? null;
    const studentName = profile?.username || user.email?.split("@")[0] || "Student";
    const levelName = getCognitiveLevelName(cognitiveLevel);

    // ── Rate Limiting (shared with chat) ──────────────────────
    const { data: rateLimitData, error: rlError } = await supabase
        .rpc("increment_api_usage", { p_user_id: user.id });

    const rlRow = Array.isArray(rateLimitData) ? rateLimitData[0] : rateLimitData;
    const MAX_DAILY = 50;

    if (!rlError && rlRow && rlRow.allowed === false) {
        return NextResponse.json(
            {
                reply: "",
                error: "لقد نفدت طاقتك اليوم! عد غداً لمواصلة رحلتك.",
                rateLimited: true,
                thinkingCategory: null,
                cognitivePoints: null,
                feedback: null,
                totalXpAwarded: 0,
                newCognitiveXp: cognitiveXp,
                newCognitiveLevel: cognitiveLevel,
                cognitiveLeveUp: false,
            },
            { status: 429 }
        );
    }

    // ── Parse request ─────────────────────────────────────────
    try {
        const body = (await request.json()) as ThinkEngineRequestBody;

        const rawMessages = (Array.isArray(body.messages) ? body.messages : [])
            .filter((m): m is ThinkEngineMessage => m && typeof m === "object" && typeof m.content === "string")
            .map((m) => ({ role: m.role, content: String(m.content).trim() }));

        const imageParsed = typeof body.image === "string" ? parseImageDataUrl(body.image) : null;
        const lastEntry = rawMessages[rawMessages.length - 1];
        const historyMessages = lastEntry?.role === "user" ? rawMessages.slice(0, -1) : rawMessages;

        const sendParts: Part[] = [];
        if (lastEntry?.role === "user" && lastEntry.content) sendParts.push({ text: lastEntry.content });
        if (imageParsed) sendParts.push({ inlineData: { mimeType: imageParsed.mimeType, data: imageParsed.data } });

        if (sendParts.length === 0) {
            return NextResponse.json({
                reply: "Send a question to start your thinking session!",
                thinkingCategory: null,
                cognitivePoints: null,
                feedback: null,
                totalXpAwarded: 0,
                newCognitiveXp: cognitiveXp,
                newCognitiveLevel: cognitiveLevel,
                cognitiveLeveUp: false,
            });
        }

        // ── Call Gemini ─────────────────────────────────────────
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            systemInstruction: getThinkEngineSystemPrompt(cognitiveLevel, levelName, academicTrack, studentName),
        });

        const chat = model.startChat({ history: buildGeminiHistory(historyMessages) });
        const result = await chat.sendMessage(sendParts);
        const responseText = result.response.text() || "No reply generated.";

        // ── Parse evaluation from response ─────────────────────
        const { reply, evaluation } = parseThinkEval(responseText);

        // ── Award cognitive XP ──────────────────────────────────
        let totalXpAwarded = 0;
        let newCognitiveXp = cognitiveXp;
        let newCognitiveLevel = cognitiveLevel;
        let cognitiveLeveUp = false;

        if (evaluation) {
            const pts = evaluation.cognitivePoints;
            totalXpAwarded = pts.patience + pts.logicalSteps + pts.deduction;

            if (totalXpAwarded > 0) {
                newCognitiveXp = cognitiveXp + totalXpAwarded;
                const newLevelInfo = getCognitiveLevelFromXp(newCognitiveXp);
                newCognitiveLevel = newLevelInfo.level;
                cognitiveLeveUp = newCognitiveLevel > cognitiveLevel;

                // Update profile in Supabase
                await supabase
                    .from("profiles")
                    .update({
                        cognitive_xp: newCognitiveXp,
                        cognitive_level: newCognitiveLevel,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", user.id);
            }
        }

        return NextResponse.json({
            reply,
            thinkingCategory: evaluation?.thinkingCategory ?? null,
            cognitivePoints: evaluation?.cognitivePoints ?? null,
            feedback: evaluation?.feedback ?? null,
            totalXpAwarded,
            newCognitiveXp,
            newCognitiveLevel,
            cognitiveLeveUp,
        });
    } catch (err: any) {
        console.error("[Think Engine Error]:", err);
        return NextResponse.json(
            {
                reply: "",
                error: err.message,
                thinkingCategory: null,
                cognitivePoints: null,
                feedback: null,
                totalXpAwarded: 0,
                newCognitiveXp: cognitiveXp,
                newCognitiveLevel: cognitiveLevel,
                cognitiveLeveUp: false,
            },
            { status: 500 }
        );
    }
}
