import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLevelFromXp, calculateDailyStreak } from "@/lib/gamification";
import { incrementMissionProgress } from "@/lib/missions";

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { xpAmount } = await request.json();

        if (typeof xpAmount !== "number" || xpAmount <= 0) {
            return NextResponse.json({ error: "Invalid XP amount" }, { status: 400 });
        }

        // Get current profile
        const { data: profile, error: fetchError } = await supabase
            .from("profiles")
            .select("xp_points, current_streak, last_active_date, highest_streak")
            .eq("id", user.id)
            .single();

        if (fetchError || !profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        const previousXp = profile.xp_points;
        const newXp = previousXp + xpAmount;

        const previousLevel = getLevelFromXp(previousXp).level;
        const newLevel = getLevelFromXp(newXp).level;
        const leveledUp = newLevel > previousLevel;

        // Calculate Streak
        const streakResult = calculateDailyStreak(profile.last_active_date);
        let newStreak = profile.current_streak || 0;
        let highestStreak = profile.highest_streak || 0;

        if (streakResult.streakUpdate === 'increment') {
            newStreak += 1;
        } else if (streakResult.streakUpdate === 'reset') {
            newStreak = 1;
        }

        if (newStreak > highestStreak) {
            highestStreak = newStreak;
        }

        // Update profile
        const { error: updateError } = await supabase
            .from("profiles")
            .update({
                xp_points: newXp,
                current_streak: newStreak,
                highest_streak: highestStreak,
                last_active_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", user.id);

        if (updateError) {
            throw updateError;
        }

        // ── Mission Tracking ────────────────────────────────────
        // 1. Track XP earned
        await incrementMissionProgress(supabase, user.id, "earn_xp", xpAmount);

        // 2. Track login streak if incremented
        if (streakResult.streakUpdate === 'increment') {
            await incrementMissionProgress(supabase, user.id, "login_streak", 1);
        }

        // 3. Track weekly XP for social leaderboard
        const now = new Date();
        const monday = new Date(now);
        // Set to current week's Monday
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        const weekStart = monday.toISOString().split('T')[0];

        await supabase.rpc("increment_weekly_xp", {
            p_user_id: user.id,
            p_xp_amount: xpAmount
        });
        // ────────────────────────────────────────────────────────

        return NextResponse.json({
            newXp,
            previousLevel,
            newLevel,
            leveledUp,
            xpAwarded: xpAmount,
            newStreak
        });

    } catch (error: any) {
        console.error("[XP API Error]:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
