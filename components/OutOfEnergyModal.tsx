"use client";

import { motion, AnimatePresence } from "framer-motion";
import { BatteryWarning, X, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface OutOfEnergyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function OutOfEnergyModal({ isOpen, onClose }: OutOfEnergyModalProps) {
    const [timeUntilReset, setTimeUntilReset] = useState("");

    useEffect(() => {
        if (!isOpen) return;

        function calcTimeLeft() {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const diff = tomorrow.getTime() - now.getTime();

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setTimeUntilReset(`${hours}h ${minutes}m`);
        }

        calcTimeLeft();
        const interval = setInterval(calcTimeLeft, 60_000);
        return () => clearInterval(interval);
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-md p-6"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.8, y: 30 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.8, y: 30, opacity: 0 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="relative w-full max-w-sm rounded-[2rem] border-4 border-primary/20 bg-card p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)] text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* Battery Icon */}
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 via-primary/20 to-yellow-500/20 shadow-inner">
                            <BatteryWarning className="h-10 w-10 text-pink-500" />
                        </div>

                        {/* Arabic Title */}
                        <h2 className="text-2xl font-black text-foreground mb-2" dir="rtl">
                            نفدت طاقتك اليوم! 🔋
                        </h2>

                        {/* Arabic Body */}
                        <p className="text-muted-foreground font-medium mb-6" dir="rtl">
                            لقد استخدمت كل رسائلك اليومية. عد بكرة عشان تكمل رحلتك التعليمية!
                        </p>

                        {/* Countdown Timer */}
                        <div className="flex items-center justify-center gap-2 rounded-2xl bg-primary/5 border-2 border-primary/10 px-4 py-3 mb-6">
                            <Clock className="h-5 w-5 text-primary" />
                            <span className="text-sm font-bold text-primary">
                                الطاقة هترجع بعد {timeUntilReset}
                            </span>
                        </div>

                        {/* CTA Buttons */}
                        <div className="space-y-3">
                            <Button
                                size="lg"
                                className="w-full h-12 text-base font-bold"
                                onClick={onClose}
                            >
                                حاضر، هرجع بكرة! 👋
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full h-12 text-base font-bold border-2 border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10"
                                disabled
                            >
                                <Sparkles className="h-5 w-5 mr-2 text-yellow-500" />
                                استخدم XP مميز ⚡ (قريباً)
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
