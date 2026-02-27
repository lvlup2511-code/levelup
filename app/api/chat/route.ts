import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getLevelFromXp } from "@/lib/gamification";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Use gemini-2.5-flash; gemini-1.5-flash returns 404 (model not found for v1beta). */
const GEMINI_MODEL = "gemini-2.5-flash";

function getSystemInstruction(level: number, username: string) {
  let modeDescription = "";
  let behaviorInstruction = "";

  if (level <= 3) {
    modeDescription = "Beginner (Friendly Guide)";
    behaviorInstruction = `Use very simple Arabic. Act as a patient, friendly guide. Focus on foundational concepts. Use encouraging analogies. If they are stuck, give them a hint but don't solve it entirely.`;
  } else if (level >= 7) {
    modeDescription = "Advanced (The Challenger)";
    behaviorInstruction = `Be a 'Challenger'. Use complex, academic terminology. Ask deep follow-up questions to verify their mental model of the concept. Don't accept surface-level answers; push them to explain the 'why'.`;
  } else {
    modeDescription = "Intermediate (Tutor)";
    behaviorInstruction = `Balance support with challenge. Use standard terminology and ask conceptual questions. Help them bridge the gap between basics and advanced topics.`;
  }

  return `You are a friendly, encouraging gamified AI tutor named LevelUp Bot. 
Talking to: ${username} (Student Level: ${level} - ${modeDescription}).
${behaviorInstruction}
Your goal is to help this student understand concepts based on their level. 
Help them understand the concept, not just give the final answer. 
If they upload an image of a question, analyze it step-by-step. 
Keep responses concise, engaging, and in Arabic if asked.`;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequestBody = {
  messages: ChatMessage[];
  image?: string;
};

export type ChatResponseBody = {
  reply: string;
  error?: string;
};

function parseImageDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1].trim(), data: match[2].trim() };
}

function historyStartingWithUser(messages: ChatMessage[]): ChatMessage[] {
  const firstUserIndex = messages.findIndex((m) => m.role === "user");
  if (firstUserIndex === -1) return [];
  return messages.slice(firstUserIndex);
}

function buildGeminiHistory(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }] as Part[],
  }));
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponseBody>> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  console.log("[chat] model:", GEMINI_MODEL, "| API key loaded:", apiKey ? `${apiKey.slice(0, 5)}...` : "NO");
  if (!apiKey) {
    return NextResponse.json({ reply: "", error: "Missing API Key" }, { status: 500 });
  }

  // Fetch User Level for Personalization
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let studentLevel = 1;
  let studentName = "Student";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("xp_points, username")
      .eq("id", user.id)
      .single();

    if (profile) {
      studentLevel = getLevelFromXp(profile.xp_points).level;
      studentName = profile.username || user.email?.split("@")[0] || "Student";
    }
  }

  try {
    const raw = await request.json();
    const body = raw as ChatRequestBody;

    const rawMessages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m): m is ChatMessage => m && typeof m === "object" && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: String(m.content).trim() }));

    const imageParsed = typeof body.image === "string" ? parseImageDataUrl(body.image) : null;
    const lastEntry = rawMessages[rawMessages.length - 1];
    const historyMessages = lastEntry?.role === "user" ? rawMessages.slice(0, -1) : rawMessages;

    const sendParts: Part[] = [];
    if (lastEntry?.role === "user" && lastEntry.content) sendParts.push({ text: lastEntry.content });
    if (imageParsed) sendParts.push({ inlineData: { mimeType: imageParsed.mimeType, data: imageParsed.data } });

    if (sendParts.length === 0) return NextResponse.json({ reply: "Send a message to start!" });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: getSystemInstruction(studentLevel, studentName),
    });

    const chat = model.startChat({ history: buildGeminiHistory(historyStartingWithUser(historyMessages)) });
    const result = await chat.sendMessage(sendParts);

    return NextResponse.json({ reply: result.response.text() || "No reply generated." });
  } catch (err: any) {
    console.error("Gemini Error:", err);
    return NextResponse.json({ reply: "", error: err.message }, { status: 500 });
  }
}