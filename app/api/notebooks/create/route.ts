import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotebook, checkSession } from "@/lib/notebooklm";

export const runtime = "nodejs";

// ────────────────────────────────────────────────────────────
// POST  /api/notebooks/create
// ────────────────────────────────────────────────────────────
// Body: { name: string }
// Creates a new LevelUp Lab (NotebookLM notebook).
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

    try {
        const { name } = await request.json();
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Lab name is required" }, { status: 400 });
        }

        const notebook = createNotebook(name.trim());
        if (!notebook) {
            return NextResponse.json({
                error: "Failed to create lab. Please try again.",
            }, { status: 500 });
        }

        return NextResponse.json({ notebook });

    } catch (err: any) {
        console.error("[Create Lab Error]:", err);
        return NextResponse.json(
            { error: err.message },
            { status: 500 }
        );
    }
}
