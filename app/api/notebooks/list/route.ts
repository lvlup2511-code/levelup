import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listNotebooks, checkSession } from "@/lib/notebooklm";

export const runtime = "nodejs";

// ────────────────────────────────────────────────────────────
// GET  /api/notebooks/list
// ────────────────────────────────────────────────────────────
// Returns available LevelUp Labs (NotebookLM notebooks).
// If the session is dead, returns { sessionDead: true }.
// ────────────────────────────────────────────────────────────

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Session guard — check if Google link is alive
    const session = checkSession();
    if (!session.authenticated) {
        return NextResponse.json({
            notebooks: [],
            sessionDead: true,
            message: session.message,
        });
    }

    // Fetch notebooks
    const notebooks = listNotebooks();
    if (notebooks === null) {
        return NextResponse.json({
            notebooks: [],
            sessionDead: false,
            message: "Failed to load labs. Please try again.",
        });
    }

    return NextResponse.json({
        notebooks,
        sessionDead: false,
    });
}
