import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAudio, downloadAudio, isAvailable } from "@/lib/notebooklm";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 300; // 5min — audio generation is long-running

// ────────────────────────────────────────────────────────────
// POST  /api/generate-podcast
// ────────────────────────────────────────────────────────────
// Body: { notebookId: string, instructions?: string }
// Returns: { audioUrl, status } | { status: "unavailable" }
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { notebookId, instructions } = await request.json();

        if (!notebookId) {
            return NextResponse.json(
                { error: "Missing notebookId" },
                { status: 400 }
            );
        }

        // Check if NotebookLM CLI is available
        if (!isAvailable()) {
            return NextResponse.json({
                status: "unavailable",
                message: "LevelUp audio service is currently unavailable. Please try again later.",
            });
        }

        // Step 1: Generate audio (blocking — waits for completion)
        console.log(`[Podcast] Generating audio for notebook ${notebookId}...`);
        const genResult = await generateAudio(notebookId, instructions);

        if (!genResult) {
            return NextResponse.json({
                status: "failed",
                message: "Audio generation failed. The service may be temporarily unavailable.",
            });
        }

        // Step 2: Download the audio to public/podcasts/
        const timestamp = Date.now();
        const filename = `podcast_${notebookId.slice(0, 8)}_${timestamp}.mp4`;
        const outputPath = path.join(process.cwd(), "public", "podcasts", filename);

        console.log(`[Podcast] Downloading audio to ${outputPath}...`);
        const dlResult = await downloadAudio(notebookId, outputPath);

        if (!dlResult) {
            return NextResponse.json({
                status: "failed",
                message: "Audio was generated but download failed.",
            });
        }

        console.log(`[Podcast] ✅ Audio ready at ${dlResult.audioUrl}`);
        return NextResponse.json({
            status: "ready",
            audioUrl: dlResult.audioUrl,
            filename: dlResult.filename,
        });

    } catch (err: any) {
        console.error("[Podcast Error]:", err);
        return NextResponse.json(
            { error: err.message, status: "failed" },
            { status: 500 }
        );
    }
}
