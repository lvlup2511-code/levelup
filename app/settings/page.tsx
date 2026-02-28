"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EDUCATION_STAGES, getOrdinalGradeAr } from "@/config/educationData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Settings,
    User,
    GraduationCap,
    Palette,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Save,
    Check,
    ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Profile, EducationStage } from "@/lib/supabase/types";

// 12 fun DiceBear avatar seeds for cycling
const AVATAR_SEEDS = [
    "Felix", "Aneka", "Milo", "Luna", "Bubba",
    "Destiny", "Garfield", "Boo", "Chester", "Patches",
    "Shadow", "Gizmo",
];

function getAvatarUrl(seed: string) {
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
}

export default function SettingsPage() {
    const router = useRouter();
    const supabase = createClient();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Editable fields
    const [username, setUsername] = useState("");
    const [educationStage, setEducationStage] = useState<EducationStage | null>(null);
    const [gradeNumber, setGradeNumber] = useState<number | null>(null);
    const [avatarSeedIndex, setAvatarSeedIndex] = useState(0);
    const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProfile() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error || !data) { router.push("/login"); return; }

            const p = data as Profile;
            setProfile(p);
            setUsername(p.username || "");
            setEducationStage(p.education_stage || null);
            setGradeNumber(p.grade_number || null);

            // Find matching seed index or default to 0
            if (p.avatar_url) {
                const matchIndex = AVATAR_SEEDS.findIndex(
                    seed => p.avatar_url === getAvatarUrl(seed)
                );
                if (matchIndex >= 0) {
                    setAvatarSeedIndex(matchIndex);
                } else {
                    setCustomAvatarUrl(p.avatar_url);
                }
            }
            setLoading(false);
        }
        fetchProfile();
    }, [router, supabase]);

    const currentAvatarUrl = customAvatarUrl || getAvatarUrl(AVATAR_SEEDS[avatarSeedIndex]);

    const cycleAvatar = (direction: number) => {
        setCustomAvatarUrl(null);
        setAvatarSeedIndex(prev => {
            const next = prev + direction;
            if (next < 0) return AVATAR_SEEDS.length - 1;
            if (next >= AVATAR_SEEDS.length) return 0;
            return next;
        });
    };

    const selectedStageData = EDUCATION_STAGES.find(s => s.id === educationStage);

    const handleSave = async () => {
        if (!profile) return;
        if (username.trim().length < 3) return;

        setSaving(true);
        setSaved(false);

        const { error } = await supabase
            .from("profiles")
            .update({
                username: username.trim(),
                education_stage: educationStage,
                grade_number: gradeNumber,
                avatar_url: currentAvatarUrl,
                updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);

        setSaving(false);
        if (!error) {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6 pt-8 pb-28 max-w-lg mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">
                        SETTINGS
                    </h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest italic opacity-70">
                        Customize your profile.
                    </p>
                </div>
                <div className="bg-primary/20 p-3 rounded-2xl">
                    <Settings className="h-6 w-6 text-primary" />
                </div>
            </header>

            {/* Avatar Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card className="border-2 border-primary/20 overflow-hidden">
                    <CardContent className="pt-6 pb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Palette className="h-5 w-5 text-primary" />
                            <span className="font-black text-sm uppercase tracking-wider text-foreground">
                                Avatar
                            </span>
                        </div>
                        <div className="flex items-center justify-center gap-6">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cycleAvatar(-1)}
                                className="rounded-full h-12 w-12 border-2 border-border hover:border-primary/40"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>

                            <div className="relative">
                                <Avatar className="h-28 w-28 border-4 border-primary/40 shadow-xl rounded-2xl overflow-hidden ring-4 ring-background">
                                    <AvatarImage src={currentAvatarUrl} alt="Avatar Preview" />
                                    <AvatarFallback>
                                        <div className="flex h-full w-full items-center justify-center bg-secondary text-5xl">
                                            👦
                                        </div>
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                                    {AVATAR_SEEDS[avatarSeedIndex]}
                                </div>
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cycleAvatar(1)}
                                className="rounded-full h-12 w-12 border-2 border-border hover:border-primary/40"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </Button>
                        </div>
                        <p className="text-center text-xs text-muted-foreground mt-4 font-medium">
                            Tap arrows to browse {AVATAR_SEEDS.length} unique avatars
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Username Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Card className="border-2 border-primary/20">
                    <CardContent className="pt-6 pb-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            <span className="font-black text-sm uppercase tracking-wider text-foreground">
                                Username
                            </span>
                        </div>
                        <Input
                            id="username"
                            placeholder="Enter your username..."
                            className="h-14 bg-card border-2 border-primary/20 focus-visible:ring-primary/30 font-bold tracking-tight rounded-2xl text-lg"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            maxLength={30}
                        />
                        {username.trim().length > 0 && username.trim().length < 3 && (
                            <p className="text-xs text-destructive font-bold">
                                Username must be at least 3 characters
                            </p>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Education Stage Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Card className="border-2 border-primary/20">
                    <CardContent className="pt-6 pb-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-primary" />
                            <span className="font-black text-sm uppercase tracking-wider text-foreground">
                                Education Stage
                            </span>
                        </div>

                        <div className="grid gap-3">
                            {EDUCATION_STAGES.map((stage) => (
                                <button
                                    key={stage.id}
                                    onClick={() => {
                                        setEducationStage(stage.id);
                                        setGradeNumber(null);
                                    }}
                                    className={cn(
                                        "flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all duration-200",
                                        "hover:shadow-md hover:scale-[1.01]",
                                        educationStage === stage.id
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-border bg-card hover:border-primary/30"
                                    )}
                                >
                                    <div className="text-3xl">{stage.emoji}</div>
                                    <div className="flex-1">
                                        <p className="font-black text-foreground uppercase tracking-tight text-sm">
                                            {stage.nameAr}
                                        </p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                            {stage.nameEn}
                                        </p>
                                    </div>
                                    {educationStage === stage.id && (
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
                                            <Check className="h-4 w-4" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Grade Selector */}
                        {selectedStageData && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="space-y-3 pt-2"
                            >
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    Select Grade
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {selectedStageData.grades.map((grade) => (
                                        <button
                                            key={grade}
                                            onClick={() => setGradeNumber(grade)}
                                            className={cn(
                                                "relative flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all duration-200",
                                                gradeNumber === grade
                                                    ? "border-primary bg-primary/10 shadow-sm"
                                                    : "border-border bg-card hover:border-primary/30"
                                            )}
                                        >
                                            <span className="text-2xl font-black text-foreground">{grade}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground text-center">
                                                {getOrdinalGradeAr(grade)}
                                            </span>
                                            {gradeNumber === grade && (
                                                <div className="absolute -right-1.5 -top-1.5">
                                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                                                        <Check className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Save Button */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <Button
                    size="lg"
                    className={cn(
                        "w-full h-14 text-lg font-black shadow-lg transition-all active:scale-95 disabled:opacity-50 rounded-2xl gap-2",
                        saved && "bg-success hover:bg-success/90"
                    )}
                    disabled={saving || username.trim().length < 3}
                    onClick={handleSave}
                >
                    {saving ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            SAVING...
                        </>
                    ) : saved ? (
                        <>
                            <Check className="h-5 w-5" />
                            SAVED!
                        </>
                    ) : (
                        <>
                            <Save className="h-5 w-5" />
                            SAVE CHANGES
                        </>
                    )}
                </Button>
            </motion.div>
        </div>
    );
}
