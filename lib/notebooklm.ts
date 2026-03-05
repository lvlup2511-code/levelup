/**
 * NotebookLM Bridge — Server-side CLI wrapper for notebooklm-py
 *
 * Shells out to the notebooklm CLI (Python) from Node.js API routes.
 * Every function catches errors and returns null on failure so callers
 * can fall through to the Gemini baseline model.
 */

import { execSync, exec } from "child_process";
import path from "path";
import fs from "fs";

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

export interface NotebookLMAnswer {
    answer: string;
    sources?: string[];
}

export interface AudioGenerationResult {
    taskId: string;
    status: "pending" | "completed" | "failed";
}

export interface AudioDownloadResult {
    audioUrl: string;
    filename: string;
}

export interface NotebookInfo {
    id: string;
    name: string;
    [key: string]: any;
}

export interface SessionStatus {
    authenticated: boolean;
    message: string;
}

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

const CLI_TIMEOUT = 8_000;  // 8s strict — prevents ETIMEDOUT freeze
const AUDIO_TIMEOUT = 1_800_000; // 30min for audio generation (--wait)

function runCLI(args: string, timeout = CLI_TIMEOUT): string | null {
    try {
        const result = execSync(`notebooklm ${args}`, {
            encoding: "utf-8",
            timeout,
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
        });
        return result.trim();
    } catch (err: any) {
        console.error(`[NotebookLM CLI] Error running "notebooklm ${args}":`, err.message);
        return null;
    }
}

function runCLIAsync(args: string, timeout = AUDIO_TIMEOUT): Promise<string | null> {
    return new Promise((resolve) => {
        const child = exec(`notebooklm ${args}`, {
            encoding: "utf-8",
            timeout,
            windowsHide: true,
        }, (err, stdout, stderr) => {
            if (err) {
                console.error(`[NotebookLM CLI Async] Error running "notebooklm ${args}":`, err.message);
                if (stderr) console.error("[NotebookLM CLI Async] stderr:", stderr);
                resolve(null);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

// ────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────

/**
 * Check if the notebooklm CLI is installed and authenticated.
 */
export function isAvailable(): boolean {
    try {
        const result = runCLI("auth check --json", 5_000);
        if (!result) return false;
        const parsed = JSON.parse(result);
        return parsed.authenticated === true || parsed.status === "ok";
    } catch {
        // If JSON parse fails, try a simpler check
        const result = runCLI("list", 5_000);
        return result !== null;
    }
}

/**
 * Ask a question to a specific NotebookLM notebook.
 * Returns the answer text or null if unavailable.
 */
export function askNotebookLM(
    notebookId: string,
    question: string
): NotebookLMAnswer | null {
    // Escape the question for shell safety
    const escapedQuestion = question.replace(/"/g, '\\"').replace(/`/g, "\\`");
    const raw = runCLI(`ask "${escapedQuestion}" -n ${notebookId} --json`);

    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        return {
            answer: parsed.answer || parsed.response || raw,
            sources: parsed.sources || [],
        };
    } catch {
        // If the output is not JSON, treat the whole output as the answer
        return { answer: raw };
    }
}

/**
 * Generate an Audio Overview (podcast) for a notebook.
 * This is a BLOCKING call that can take 2–30+ minutes with --wait.
 * For non-blocking, omit --wait and poll with artifact commands.
 */
export async function generateAudio(
    notebookId: string,
    instructions?: string
): Promise<AudioGenerationResult | null> {
    const instrPart = instructions
        ? `"${instructions.replace(/"/g, '\\"')}"`
        : "";
    const raw = await runCLIAsync(
        `generate audio ${instrPart} -n ${notebookId} --wait --json`
    );

    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        return {
            taskId: parsed.task_id || parsed.artifact_id || "unknown",
            status: parsed.status === "completed" ? "completed" : "pending",
        };
    } catch {
        // If we got any output at all, generation likely succeeded
        return { taskId: "unknown", status: "completed" };
    }
}

/**
 * Download the latest audio artifact from a notebook to a local path.
 * Returns the download result or null on failure.
 */
export async function downloadAudio(
    notebookId: string,
    outputPath: string
): Promise<AudioDownloadResult | null> {
    // Ensure the output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const raw = await runCLIAsync(
        `download audio "${outputPath}" -n ${notebookId} --latest --force`,
        60_000
    );

    if (raw === null) return null;

    // Verify the file was actually written
    if (fs.existsSync(outputPath)) {
        const filename = path.basename(outputPath);
        return {
            audioUrl: `/podcasts/${filename}`,
            filename,
        };
    }

    return null;
}

/**
 * List available notebooks. Returns parsed array or null.
 */
export function listNotebooks(): NotebookInfo[] | null {
    const raw = runCLI("list --json", 15_000);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        // Handle both array and object-wrapped responses
        const notebooks = Array.isArray(parsed) ? parsed : (parsed.notebooks || parsed.results || []);
        return notebooks.map((n: any) => ({
            id: n.id || n.notebook_id || "",
            name: n.name || n.title || "Untitled",
            ...n,
        }));
    } catch {
        return null;
    }
}

/**
 * Create a new notebook with the given name.
 */
export function createNotebook(name: string): NotebookInfo | null {
    const escapedName = name.replace(/"/g, '\\"');
    const raw = runCLI(`create --name "${escapedName}" --json`, 30_000);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        return {
            id: parsed.id || parsed.notebook_id || "",
            name: parsed.name || parsed.title || name,
            ...parsed,
        };
    } catch {
        // If the output isn't JSON but the command succeeded, return minimal info
        return { id: "unknown", name };
    }
}

/**
 * Check if the Google session is alive.
 * Used by the frontend session guard to show "Re-link Account" button.
 */
export function checkSession(): SessionStatus {
    try {
        const result = runCLI("auth check --json", 10_000);
        if (!result) {
            return { authenticated: false, message: "Session check failed. Please re-link your Google account." };
        }
        const parsed = JSON.parse(result);
        const authed = parsed.authenticated === true || parsed.status === "ok";
        return {
            authenticated: authed,
            message: authed ? "Session active" : "Session expired. Please re-link your Google account.",
        };
    } catch {
        return { authenticated: false, message: "Unable to verify session. Please re-link your Google account." };
    }
}

/**
 * Add a source file to a notebook.
 * The file must exist on disk. Returns true on success, false on failure.
 */
export function addSource(notebookId: string, filePath: string): boolean {
    const escapedPath = filePath.replace(/\\/g, "/").replace(/"/g, '\\"');
    const result = runCLI(`source add "${escapedPath}" -n ${notebookId}`, 15_000);
    return result !== null;
}

// ────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────

/** Default notebook ID for English subject (El Moasser Curriculum) */
export const ENGLISH_NOTEBOOK_ID = "62120c87-579d-46ec-821d-7b1cd5bfea4e";
