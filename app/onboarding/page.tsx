"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EDUCATION_STAGES, getOrdinalGradeAr } from "@/config/educationData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowRight, ArrowLeft, Loader2, Sparkles, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

type Step = "stage" | "grade";

export default function OnboardingPage() {
    const router = useRouter();
    const supabase = createClient();
    const [step, setStep] = useState<Step>("stage");
    const [selectedStage, setSelectedStage] = useState<typeof EDUCATION_STAGES[number] | null>(null);
    const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
            } else {
                setUser(user);
            }
        }
        checkUser();
    }, [router, supabase.auth]);

    async function handleSubmit() {
        if (!selectedStage || !selectedGrade || !user) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({
                    education_stage: selectedStage.id,
                    grade_number: selectedGrade,
                    onboarding_completed: true,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

            if (error) throw error;

            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#3b82f6", "#22c55e", "#eab308", "#ec4899"],
            });

            // Brief delay for confetti
            setTimeout(() => {
                router.push("/");
                router.refresh();
            }, 1500);
        } catch (err) {
            console.error("Onboarding error:", err);
            setLoading(false);
        }
    }

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
        exit: { opacity: 0, x: -20, transition: { duration: 0.3 } },
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-success/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-xl">
                <header className="mb-8 text-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4"
                    >
                        <GraduationCap className="h-8 w-8 text-primary" />
                    </motion.div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                        Welcome to <span className="text-primary">LevelUp</span>!
                    </h1>
                    <p className="mt-2 text-muted-foreground font-medium">
                        Let's personalize your learning journey.
                    </p>
                </header>

                <AnimatePresence mode="wait">
                    {step === "stage" ? (
                        <motion.div
                            key="stage-step"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="space-y-6"
                        >
                            <div className="grid gap-4 sm:grid-cols-1">
                                {EDUCATION_STAGES.map((stage) => (
                                    <button
                                        key={stage.id}
                                        onClick={() => {
                                            setSelectedStage(stage);
                                            setSelectedGrade(null);
                                            setStep("grade");
                                        }}
                                        className={cn(
                                            "group relative flex items-center gap-6 rounded-3xl border-4 p-6 text-left transition-all duration-300",
                                            "hover:shadow-xl hover:scale-[1.02]",
                                            selectedStage?.id === stage.id
                                                ? "border-primary bg-primary/5 shadow-md"
                                                : "border-border bg-card hover:border-primary/40"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl shadow-sm transition-transform group-hover:rotate-12",
                                            stage.color.replace('bg-', 'bg-opacity-20 ')
                                        )}>
                                            {stage.emoji}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xl font-bold text-foreground">{stage.nameAr}</h3>
                                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                                                    {stage.nameEn}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
                                        </div>
                                        {selectedStage?.id === stage.id && (
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                                                    <Check className="h-5 w-5" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="grade-step"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="space-y-6"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setStep("stage")}
                                    className="rounded-full"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">{selectedStage?.nameAr}</h2>
                                    <p className="text-sm text-muted-foreground">Select your grade</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {selectedStage?.grades.map((grade) => (
                                    <button
                                        key={grade}
                                        onClick={() => setSelectedGrade(grade)}
                                        className={cn(
                                            "relative flex flex-col items-center justify-center rounded-2xl border-2 p-6 transition-all duration-200",
                                            selectedGrade === grade
                                                ? "border-primary bg-primary/10 shadow-sm"
                                                : "border-border bg-card hover:border-primary/30"
                                        )}
                                    >
                                        <span className="text-3xl font-black text-foreground">{grade}</span>
                                        <span className="text-xs font-bold text-muted-foreground mt-1 text-center">
                                            {getOrdinalGradeAr(grade)}
                                        </span>
                                        {selectedGrade === grade && (
                                            <div className="absolute -right-2 -top-2">
                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="pt-6">
                                <Button
                                    size="lg"
                                    className="w-full h-14 text-lg font-black shadow-lg transition-all active:scale-95 disabled:opacity-50"
                                    disabled={!selectedGrade || loading}
                                    onClick={handleSubmit}
                                >
                                    {loading ? (
                                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                    ) : (
                                        <Sparkles className="h-6 w-6 mr-2" />
                                    )}
                                    {loading ? "PREPARING YOUR WORLD..." : "START YOUR QUEST!"}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <footer className="mt-12 text-center text-xs text-muted-foreground opacity-60">
                    <p>© 2026 LevelUp — Egyptian Curriculum Edition</p>
                </footer>
            </div>
        </div>
    );
}
