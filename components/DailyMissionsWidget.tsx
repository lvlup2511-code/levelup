"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Gift, Loader2, Sparkles, Coins } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { UserMission, DailyMission } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export default function DailyMissionsWidget() {
    const [missions, setMissions] = useState<UserMission[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<number | null>(null);
    const supabase = createClient();

    const fetchMissions = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Assign/Fetch today's missions via RPC
            const { error: rpcError } = await supabase.rpc("assign_daily_missions", {
                p_user_id: user.id,
            });

            if (rpcError) throw rpcError;

            // 2. Fetch the missions with their template details
            const { data, error } = await supabase
                .from("user_missions")
                .select(`
          *,
          mission:daily_missions(*)
        `)
                .eq("user_id", user.id)
                .eq("assigned_date", new Date().toISOString().split("T")[0])
                .order("id");

            if (error) throw error;
            setMissions(data || []);
        } catch (error) {
            console.error("Error fetching missions:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMissions();
    }, []);

    const claimReward = async (missionId: number) => {
        setClaimingId(missionId);
        try {
            const { data, error } = await supabase.rpc("claim_mission_reward", {
                p_mission_id: missionId,
            });

            if (error) throw error;
            if (data && data.success) {
                // 🎉 Confetti!
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ["#FFD700", "#FFA500", "#00FF00"],
                });

                // Update local state
                setMissions((prev) =>
                    prev.map((m) =>
                        m.id === missionId ? { ...m, is_claimed: true } : m
                    )
                );
            }
        } catch (error) {
            console.error("Error claiming reward:", error);
        } finally {
            setClaimingId(null);
        }
    };

    if (loading) {
        return (
            <Card className="border-2 border-primary/20 bg-card/50">
                <CardContent className="flex h-40 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                </CardContent>
            </Card>
        );
    }

    if (missions.length === 0) return null;

    return (
        <Card className="border-2 border-primary/20 bg-card/80 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-primary/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                        <Gift className="h-5 w-5" />
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Daily Missions</CardTitle>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-400/20 px-2 py-1 rounded-full border border-yellow-400/30">
                        <Sparkles className="h-3 w-3 text-yellow-600" />
                        <span className="text-[10px] font-bold text-yellow-700 uppercase">Rewards Active</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {missions.map((userMission) => {
                    const m = userMission.mission as DailyMission;
                    if (!m) return null;

                    const progress = Math.min((userMission.current_value / m.target_value) * 100, 100);
                    const isCompleted = userMission.is_completed;
                    const isClaimed = userMission.is_claimed;

                    return (
                        <div key={userMission.id} className="relative group">
                            <div className="flex items-start gap-3 mb-2">
                                <div className="text-2xl mt-1 h-10 w-10 flex items-center justify-center bg-background rounded-xl border border-border group-hover:scale-110 transition-transform">
                                    {m.emoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <h3 className="text-sm font-bold text-foreground leading-tight truncate" dir="rtl">
                                            {m.title_ar}
                                        </h3>
                                        <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 rounded uppercase">
                                            {userMission.current_value} / {m.target_value}
                                        </span>
                                    </div>
                                    <Progress value={progress} className="h-2 mb-2" />

                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-3">
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                <Zap className="h-3 w-3 text-blue-500 fill-blue-500" />
                                                +{m.xp_reward} XP
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100">
                                                <Coins className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                                +{m.coin_reward}
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            disabled={!isCompleted || isClaimed || claimingId === userMission.id}
                                            onClick={() => claimReward(userMission.id)}
                                            className={cn(
                                                "h-7 px-3 text-[10px] font-black uppercase transition-all shrink-0",
                                                isCompleted && !isClaimed
                                                    ? "bg-success hover:bg-success/90 text-success-foreground shadow-[0_2px_0_0_rgba(16,185,129,0.4)]"
                                                    : "bg-secondary text-muted-foreground grayscale cursor-not-allowed"
                                            )}
                                        >
                                            {claimingId === userMission.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : isClaimed ? (
                                                <span className="flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3" /> CLAIMED
                                                </span>
                                            ) : (
                                                "CLAIM"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            {userMission.id !== missions[missions.length - 1].id && (
                                <div className="h-px bg-border/50 mt-4" />
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

// Mini Lucide shim for Zap if not imported (it's in the imports above anyway)
import { Zap } from "lucide-react";
