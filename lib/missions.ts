import { SupabaseClient } from "@supabase/supabase-js";
import type { MissionType } from "./supabase/types";

/**
 * Silently increments mission progress for a user.
 * This should be called from the server-side (API routes).
 */
export async function incrementMissionProgress(
    supabase: SupabaseClient,
    userId: string,
    missionType: MissionType,
    increment: number = 1
) {
    try {
        // 1. Find the active mission for this user and type for today
        const today = new Date().toISOString().split("T")[0];

        // We join with daily_missions to filter by mission_type
        const { data: userMissions, error } = await supabase
            .from("user_missions")
            .select(`
        id,
        current_value,
        daily_missions!inner (
          id,
          mission_type,
          target_value
        )
      `)
            .eq("user_id", userId)
            .eq("assigned_date", today)
            .eq("daily_missions.mission_type", missionType)
            .eq("is_completed", false); // Only increment if not already completed

        if (error || !userMissions || userMissions.length === 0) {
            return; // No active mission of this type today
        }

        for (const um of userMissions) {
            const dm = um.daily_missions as any;
            const newValue = um.current_value + increment;
            const isCompleted = newValue >= dm.target_value;

            await supabase
                .from("user_missions")
                .update({
                    current_value: newValue,
                    is_completed: isCompleted,
                    completed_at: isCompleted ? new Date().toISOString() : null
                })
                .eq("id", um.id);
        }
    } catch (error) {
        console.error("Error incrementing mission progress:", error);
    }
}
