"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface AudioPlayerProps {
    src: string;
    title?: string;
    className?: string;
}

export default function AudioPlayer({ src, title, className }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateProgress = () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
                setCurrentTime(audio.currentTime);
            }
        };

        const onLoaded = () => setDuration(audio.duration);
        const onEnded = () => setIsPlaying(false);

        audio.addEventListener("timeupdate", updateProgress);
        audio.addEventListener("loadedmetadata", onLoaded);
        audio.addEventListener("ended", onEnded);

        return () => {
            audio.removeEventListener("timeupdate", updateProgress);
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("ended", onEnded);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.muted = !audio.muted;
        setIsMuted(!isMuted);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = x / rect.width;
        audio.currentTime = pct * audio.duration;
    };

    const formatTime = (t: number) => {
        if (!t || isNaN(t)) return "0:00";
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "relative group rounded-2xl overflow-hidden",
                className
            )}
        >
            {/* Gradient border glow */}
            <div className={cn(
                "absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-violet-500 via-primary to-violet-500 transition-opacity duration-700",
                isPlaying ? "opacity-60 animate-pulse" : "opacity-20"
            )} />

            {/* Card body */}
            <div className="relative bg-card/95 backdrop-blur-md rounded-2xl p-4 border border-border/50">
                <audio ref={audioRef} src={src} preload="metadata" />

                <div className="flex items-center gap-4">
                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center shadow-lg transition-all shrink-0",
                            isPlaying
                                ? "bg-gradient-to-br from-violet-600 to-primary text-white scale-105"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                        )}
                    >
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </button>

                    {/* Info + Progress */}
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 shrink-0">
                                    🎓 LEVELUP AUDIO
                                </span>
                                {title && (
                                    <span className="text-xs font-bold text-foreground truncate">
                                        {title}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-mono font-bold text-muted-foreground tabular-nums">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                                <button
                                    onClick={toggleMute}
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                    {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div
                            onClick={handleSeek}
                            className="h-1.5 bg-secondary rounded-full cursor-pointer overflow-hidden group/bar"
                        >
                            <motion.div
                                className="h-full bg-gradient-to-r from-violet-500 to-primary rounded-full relative"
                                style={{ width: `${progress}%` }}
                                transition={{ duration: 0.1 }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md border-2 border-primary opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
