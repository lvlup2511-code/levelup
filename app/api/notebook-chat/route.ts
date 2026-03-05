import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getCognitiveLevelFromXp, getCognitiveLevelName } from "@/lib/gamification";
import type { ThinkingCategory } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

// ────────────────────────────────────────────────────────────
// SYSTEM PROMPT GENERATOR
// ────────────────────────────────────────────────────────────

function getNotebookSystemPrompt(
    docTitle: string,
    docContent: string,
    username: string,
    cognitiveLevel: number,
    levelName: string
): string {
    return `You are the LevelUp "Smart Study Room" AI Tutor. You are an expert on the following document:

═══════════════════════════════════════════
DOCUMENT TITLE: ${docTitle}
DOCUMENT CONTENT:
${docContent}
═══════════════════════════════════════════

STUDENT CONTEXT:
Name: ${username}
Cognitive Level: ${cognitiveLevel}/12 — "${levelName}"

CORE RULES:
1. **STRICT GROUNDING**: Answer the student's questions ONLY based on the content of the provided document. If a concept or answer is not in the text, politely tell ${username} that the information isn't in this specific material and guide them back to topics that ARE covered.
2. **SOCRATIC METHOD**: Do not just give answers. Guide the student to find the answer themselves by asking probing questions or pointing to specific sections of the text.
3. **EVALUATION**: Like the LevelUp Think Engine, you must evaluate their learning process.

You MUST end every response with a JSON block wrapped in <think_eval> tags.

Example:
<think_eval>
{
  "thinkingCategory": "logical_analysis",
  "cognitivePoints": {
    "patience": 3,
    "logicalSteps": 4,
    "deduction": 2
  },
  "feedback": "I like how you connected the definition of [Concept] to the examples in the second paragraph."
}
</think_eval>

Note: For the FIRST interaction where they just select a document, welcome them and ask if they have any questions about ${docTitle}.`;
}

// ────────────────────────────────────────────────────────────
// PARSING & TYPES
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
    if (!evalMatch) return { reply: text.trim(), evaluation: null };
    const reply = text.replace(/<think_eval>[\s\S]*?<\/think_eval>/, "").trim();
    try {
        const parsed = JSON.parse(evalMatch[1]);
        return {
            reply,
            evaluation: {
                thinkingCategory: parsed.thinkingCategory || "logical_analysis",
                cognitivePoints: {
                    patience: Math.min(Math.max(parsed.cognitivePoints?.patience || 0, 0), 5),
                    logicalSteps: Math.min(Math.max(parsed.cognitivePoints?.logicalSteps || 0, 0), 5),
                    deduction: Math.min(Math.max(parsed.cognitivePoints?.deduction || 0, 0), 5),
                },
                feedback: parsed.feedback || "",
            }
        };
    } catch {
        return { reply, evaluation: null };
    }
}

export async function POST(request: NextRequest) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing API Key" }, { status: 500 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { material_id, messages } = await request.json();
        if (!material_id) return NextResponse.json({ error: "No material selected" }, { status: 400 });

        // 1. Fetch Material Content
        const { data: material, error: matError } = await supabase
            .from("study_materials")
            .select("title, content")
            .eq("id", material_id)
            .eq("user_id", user.id)
            .single();

        if (matError || !material) {
            return NextResponse.json({ error: "Material not found or access denied" }, { status: 404 });
        }

        // 2. Fetch User Profile for Level-aware Tutoring
        const { data: profile } = await supabase
            .from("profiles")
            .select("username, cognitive_level, cognitive_xp")
            .eq("id", user.id)
            .single();

        const cognitiveLevel = profile?.cognitive_level || 1;
        const levelName = getCognitiveLevelName(cognitiveLevel);
        const username = profile?.username || "Student";

        // 3. Gemini Configuration
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            systemInstruction: getNotebookSystemPrompt(material.title, material.content, username, cognitiveLevel, levelName),
        });

        const history = messages.slice(0, -1).map((m: any) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }] as Part[],
        }));

        const lastMessage = messages[messages.length - 1].content;
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastMessage);
        const responseText = result.response.text();

        const { reply, evaluation } = parseThinkEval(responseText);

        // 4. Award Cognitive XP (Consistent with Think Engine)
        let totalXpAwarded = 0;
        if (evaluation) {
            totalXpAwarded = evaluation.cognitivePoints.patience + evaluation.cognitivePoints.logicalSteps + evaluation.cognitivePoints.deduction;
            if (totalXpAwarded > 0) {
                const newXp = (profile?.cognitive_xp || 0) + totalXpAwarded;
                const { level: newLevel } = getCognitiveLevelFromXp(newXp);

                await supabase
                    .from("profiles")
                    .update({
                        cognitive_xp: newXp,
                        cognitive_level: newLevel,
                    })
                    .eq("id", user.id);
            }
        }

        return NextResponse.json({
            reply,
            evaluation,
            totalXpAwarded
        });

    } catch (err: any) {
        console.error("[Notebook AI Error]:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
