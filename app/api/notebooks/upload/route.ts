import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addSource, checkSession } from "@/lib/notebooklm";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// ────────────────────────────────────────────────────────────
// POST  /api/notebooks/upload
// ────────────────────────────────────────────────────────────
// Accepts FormData with:
//   file: File
//   notebookId: string
//
// Saves file to temp, runs CLI to add as source, cleans up.
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Session guard
    const session = checkSession();
    if (!session.authenticated) {
        return NextResponse.json({
            error: "Session expired",
            sessionDead: true,
            message: session.message,
        }, { status: 401 });
    }

    let tempPath: string | null = null;

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const notebookId = formData.get("notebookId") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }
        if (!notebookId) {
            return NextResponse.json({ error: "No lab selected" }, { status: 400 });
        }

        // Write file to temp directory
        const tempDir = join(tmpdir(), "levelup-uploads");
        if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
        }

        const ext = file.name.split(".").pop() || "bin";
        const safeName = `${randomUUID()}.${ext}`;
        tempPath = join(tempDir, safeName);

        const buffer = Buffer.from(await file.arrayBuffer());
        writeFileSync(tempPath, buffer);

        console.log(`[Upload] Saved temp file: ${tempPath} (${buffer.length} bytes)`);

        // Upload to NotebookLM via CLI
        const success = addSource(notebookId, tempPath);

        if (success) {
            console.log(`[Upload] ✅ Source added to notebook ${notebookId}`);
            return NextResponse.json({
                status: "success",
                message: `"${file.name}" uploaded to your LevelUp Lab.`,
                filename: file.name,
            });
        } else {
            console.warn(`[Upload] ❌ CLI failed for notebook ${notebookId}`);
            return NextResponse.json({
                status: "failed",
                message: "Upload failed. The lab service may be temporarily unavailable. Please try again.",
            }, { status: 500 });
        }

    } catch (err: any) {
        console.error("[Upload Error]:", err);
        return NextResponse.json(
            { error: err.message || "Upload failed" },
            { status: 500 }
        );
    } finally {
        // Always clean up temp file
        if (tempPath && existsSync(tempPath)) {
            try {
                unlinkSync(tempPath);
                console.log(`[Upload] 🗑️ Cleaned up temp file: ${tempPath}`);
            } catch (cleanupErr) {
                console.warn("[Upload] Cleanup warning:", cleanupErr);
            }
        }
    }
}
