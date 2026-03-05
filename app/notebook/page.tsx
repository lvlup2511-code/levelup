"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import AudioPlayer from "@/components/AudioPlayer";
import {
    Book,
    Plus,
    Send,
    Loader2,
    Trash2,
    MessageSquare,
    FileText,
    Brain,
    X,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    ListChecks,
    Mic,
    FileSearch,
    UploadCloud,
    FileUp,
    Link,
    FlaskConical,
    RefreshCw,
    AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import type { StudyMaterial } from "@/lib/supabase/types";

export default function NotebookPage() {
    const [materials, setMaterials] = useState<StudyMaterial[]>([]);
    const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [isReading, setIsReading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState("");
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Chat state
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Podcast state
    const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
    const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
    const [podcastError, setPodcastError] = useState<string | null>(null);

    // Lab management state
    const [labs, setLabs] = useState<{ id: string; name: string }[]>([]);
    const [selectedLabId, setSelectedLabId] = useState<string>("");
    const [isLoadingLabs, setIsLoadingLabs] = useState(false);
    const [isCreatingLab, setIsCreatingLab] = useState(false);
    const [newLabName, setNewLabName] = useState("");
    const [sessionDead, setSessionDead] = useState(false);
    const [sessionMessage, setSessionMessage] = useState("");

    const supabase = createClient();

    useEffect(() => {
        fetchMaterials();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchMaterials = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("study_materials")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching materials:", error);
        } else {
            setMaterials(data || []);
            if (data && data.length > 0 && !selectedMaterial) {
                setSelectedMaterial(data[0]);
            }
        }
        setLoading(false);
    };

    const handleImport = async () => {
        if (!newTitle.trim() || (!newContent.trim() && !selectedLabId)) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setLoading(true);

        // ── Step 1: If there is a pending file + lab, upload directly ──
        if (pendingFile && selectedLabId) {
            setIsUploading(true);
            setUploadStatus("Uploading to LevelUp Lab...");
            try {
                const formData = new FormData();
                formData.append("file", pendingFile);
                formData.append("notebookId", selectedLabId);

                const uploadRes = await fetch("/api/notebooks/upload", {
                    method: "POST",
                    body: formData,
                });
                const uploadData = await uploadRes.json();

                if (uploadData.status === "success") {
                    setUploadStatus(`✅ ${uploadData.message}`);
                } else if (uploadData.sessionDead) {
                    setSessionDead(true);
                    setSessionMessage(uploadData.message || "Session expired.");
                    setUploadStatus("⚠️ Session expired. Please re-link your account.");
                    setLoading(false);
                    setIsUploading(false);
                    return;
                } else {
                    setUploadStatus(`⚠️ ${uploadData.message || "Upload failed. Content saved locally."}`);
                }
            } catch (err: any) {
                console.error("Upload error:", err);
                setUploadStatus("⚠️ Upload failed. Content saved locally instead.");
            } finally {
                setIsUploading(false);
            }
        }

        // ── Step 2: Save material to Supabase ──
        const { data, error } = await supabase
            .from("study_materials")
            .insert({
                user_id: user.id,
                title: newTitle,
                content: newContent,
                ...(selectedLabId ? { notebook_id: selectedLabId } : {}),
            })
            .select()
            .single();

        if (error) {
            alert("Error adding material: " + error.message);
        } else {
            setMaterials([data, ...materials]);
            setSelectedMaterial(data);
            setIsAdding(false);
            setNewTitle("");
            setNewContent("");
            setSelectedLabId("");
            setPendingFile(null);
            setMessages([]);
        }
        setLoading(false);
    };

    // ── Lab management ─────────────────────────────────────
    const fetchLabs = useCallback(async () => {
        setIsLoadingLabs(true);
        try {
            const res = await fetch("/api/notebooks/list");
            const data = await res.json();
            if (data.sessionDead) {
                setSessionDead(true);
                setSessionMessage(data.message || "Session expired.");
                setLabs([]);
            } else {
                setSessionDead(false);
                setLabs(data.notebooks || []);
            }
        } catch {
            setLabs([]);
        } finally {
            setIsLoadingLabs(false);
        }
    }, []);

    const handleCreateLab = async () => {
        if (!newLabName.trim()) return;
        setIsCreatingLab(true);
        try {
            const res = await fetch("/api/notebooks/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newLabName.trim() }),
            });
            const data = await res.json();
            if (data.notebook) {
                setLabs(prev => [data.notebook, ...prev]);
                setSelectedLabId(data.notebook.id);
                setNewLabName("");
            } else if (data.sessionDead) {
                setSessionDead(true);
                setSessionMessage(data.message || "Session expired.");
            } else {
                alert(data.error || "Failed to create lab.");
            }
        } catch (err: any) {
            alert("Error creating lab: " + err.message);
        } finally {
            setIsCreatingLab(false);
        }
    };

    // Fetch labs when modal opens
    useEffect(() => {
        if (isAdding) fetchLabs();
    }, [isAdding, fetchLabs]);

    const handleFileRead = async (file: File) => {
        if (!file) return;

        setIsReading(true);
        setUploadStatus("");

        // Always store the file for potential direct upload
        setPendingFile(file);

        // Auto-fill title from filename
        if (!newTitle) {
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            setNewTitle(baseName.toUpperCase());
        }

        const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
        const isImage = file.type.startsWith("image/");

        try {
            if (isPdf || isImage) {
                // PDFs & images are uploaded directly to the LevelUp Lab backend
                const label = isPdf ? "PDF" : "Image";
                if (selectedLabId) {
                    setUploadStatus(`📎 ${label} ready for upload to your LevelUp Lab. Click IMPORT TO LAB to proceed.`);
                } else {
                    setUploadStatus(`📎 ${label} selected. Link a LevelUp Lab above to upload directly.`);
                }
                setNewContent(`[${label} file: ${file.name} — will be uploaded to LevelUp Lab]`);
            } else {
                setUploadStatus(`Reading ${file.name}...`);
                const text = await file.text();
                setNewContent(text);
                setUploadStatus(`✅ Loaded ${text.length.toLocaleString()} characters from ${file.name}`);
            }
        } catch (error: any) {
            console.error("File read error:", error);
            setUploadStatus("");
            alert(
                `❌ Failed to read "${file.name}".\n\n` +
                `Please copy and paste the text manually into the content area below.`
            );
        } finally {
            setIsReading(false);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileRead(file);
    };

    const handleDeleteMaterial = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this material?")) return;

        const { error } = await supabase
            .from("study_materials")
            .delete()
            .eq("id", id);

        if (error) {
            alert("Error deleting: " + error.message);
        } else {
            const nextMaterials = materials.filter(m => m.id !== id);
            setMaterials(nextMaterials);
            if (selectedMaterial?.id === id) {
                setSelectedMaterial(nextMaterials[0] || null);
                setMessages([]);
            }
        }
    };

    const handleSendMessage = async (overridePrompt?: string) => {
        const prompt = overridePrompt || inputValue;
        if (!prompt.trim() || !selectedMaterial || isSending) return;

        const userMessage = { role: "user", content: prompt };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        if (!overridePrompt) setInputValue("");
        setIsSending(true);

        try {
            const response = await fetch("/api/notebook-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    material_id: selectedMaterial.id,
                    notebookId: selectedMaterial.notebook_id,
                    messages: newMessages,
                }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setMessages([...newMessages, { role: "assistant", content: data.reply, evaluation: data.evaluation }]);
        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setIsSending(false);
        }
    };

    const handleGeneratePodcast = async () => {
        if (!selectedMaterial || isGeneratingPodcast) return;
        setIsGeneratingPodcast(true);
        setPodcastError(null);
        setPodcastUrl(null);

        try {
            const response = await fetch("/api/generate-podcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    notebookId: selectedMaterial.notebook_id || selectedMaterial.id,
                    instructions: `Create an engaging podcast discussing the main ideas of: ${selectedMaterial.title}`,
                }),
            });

            const data = await response.json();

            if (data.status === "ready" && data.audioUrl) {
                setPodcastUrl(data.audioUrl);
            } else if (data.status === "unavailable") {
                setPodcastError("Audio engine is momentarily unavailable. Using AI text mode instead.");
                // Fallback: send as a chat message
                handleSendMessage("Write an engaging, fun podcast script between two hosts (Host A and Host B) discussing the main ideas of this document.");
            } else {
                setPodcastError(data.message || "Podcast generation failed.");
            }
        } catch (error: any) {
            setPodcastError("Failed to generate podcast: " + error.message);
        } finally {
            setIsGeneratingPodcast(false);
        }
    };

    const QUICK_ACTIONS = [
        { id: "summary", label: "Summary", icon: FileSearch, prompt: "Summarize this document in 5 key bullet points.", color: "text-blue-500", bg: "bg-blue-500/10" },
        { id: "quiz", label: "Quick Quiz", icon: ListChecks, prompt: "Generate a 3-question multiple-choice quiz based on this text.", color: "text-amber-500", bg: "bg-amber-500/10" },
    ];

    return (
        <div className="flex h-screen bg-background overflow-hidden w-full relative">

            {/* ── Sidebar (Library) ────────────────────────────── */}
            <motion.aside
                initial={false}
                animate={{ width: sidebarOpen ? 320 : 0, opacity: sidebarOpen ? 1 : 0 }}
                className={cn(
                    "border-r bg-card/50 backdrop-blur-md flex flex-col h-full z-20 overflow-hidden",
                    !sidebarOpen && "border-none"
                )}
            >
                <div className="p-6 border-b flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/20 p-2 rounded-xl">
                            <Book className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="font-black text-lg tracking-tight uppercase">Study Library</h2>
                    </div>
                </div>

                <div className="p-4 shrink-0">
                    <Button
                        onClick={() => setIsAdding(true)}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-12 shadow-lg gap-2"
                    >
                        <Plus className="h-5 w-5" />
                        ADD MATERIAL
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading && materials.length === 0 ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>
                    ) : (
                        materials.map(m => (
                            <button
                                key={m.id}
                                onClick={() => {
                                    setSelectedMaterial(m);
                                    setMessages([]);
                                }}
                                className={cn(
                                    "w-full p-4 rounded-2xl flex items-center gap-3 transition-all text-left border-2 group",
                                    selectedMaterial?.id === m.id
                                        ? "border-primary bg-primary/5 shadow-md"
                                        : "border-transparent hover:border-primary/20 hover:bg-secondary/50"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-xl shrink-0",
                                    selectedMaterial?.id === m.id ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                                )}>
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate uppercase tracking-tight">{m.title}</p>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase truncate">
                                        {new Date(m.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-destructive transition-opacity"
                                    onClick={(e) => handleDeleteMaterial(m.id, e)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </button>
                        ))
                    )}
                </div>
            </motion.aside>

            {/* Sidebar Toggle Button */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-30 h-12 w-6 bg-card border border-l-0 rounded-l-none rounded-r-xl shadow-md hover:bg-accent hidden md:flex"
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>

            {/* ── Main Area (Chat) ──────────────────────────────── */}
            <main className="flex-1 flex flex-col min-w-0 bg-background relative h-full">

                {selectedMaterial ? (
                    <>
                        {/* Header */}
                        <header className="p-6 border-b backdrop-blur-md bg-background/80 z-10 shrink-0 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="md:hidden">
                                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                        <Plus className={cn("h-5 w-5 transition-transform", sidebarOpen ? "rotate-45" : "rotate-0")} />
                                    </Button>
                                </div>
                                <div>
                                    <h1 className="text-xl font-black tracking-tighter text-primary uppercase truncate max-w-[200px] md:max-w-md">
                                        {selectedMaterial.title}
                                    </h1>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic opacity-70">
                                        <Brain className="h-3 w-3 text-primary" />
                                        Smart Study Session Active
                                    </div>
                                </div>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-success/10 rounded-full">
                                <Sparkles className="h-4 w-4 text-success" />
                                <span className="text-[10px] font-black text-success uppercase">LevelUp AI Tutor</span>
                            </div>
                        </header>

                        {/* Quick Actions Bar */}
                        <div className="px-6 py-3 border-b bg-card/20 flex items-center gap-3 overflow-x-auto no-scrollbar shrink-0">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2 flex items-center gap-1 shrink-0">
                                <Sparkles className="h-3 w-3" /> Quick Actions:
                            </span>
                            {QUICK_ACTIONS.map(action => (
                                <Button
                                    key={action.id}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSendMessage(action.prompt)}
                                    disabled={isSending}
                                    className={cn(
                                        "rounded-full h-8 px-4 text-[10px] font-black uppercase tracking-wider gap-2 border border-transparent hover:border-current transition-all shrink-0",
                                        action.bg,
                                        action.color
                                    )}
                                >
                                    <action.icon className="h-3.5 w-3.5" />
                                    {action.label}
                                </Button>
                            ))}
                            {/* Podcast Button — triggers real Audio Overview */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleGeneratePodcast}
                                disabled={isSending || isGeneratingPodcast}
                                className={cn(
                                    "rounded-full h-8 px-4 text-[10px] font-black uppercase tracking-wider gap-2 border border-transparent hover:border-current transition-all shrink-0",
                                    "bg-violet-500/10 text-violet-500"
                                )}
                            >
                                {isGeneratingPodcast ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        GENERATING...
                                    </>
                                ) : (
                                    <>
                                        <Mic className="h-3.5 w-3.5" />
                                        Audio Masterclass
                                    </>
                                )}
                            </Button>
                        </div>

                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
                        >
                            {/* Podcast Audio Player */}
                            {podcastUrl && (
                                <AudioPlayer
                                    src={podcastUrl}
                                    title={`LevelUp Audio Masterclass — ${selectedMaterial?.title}`}
                                    className="mb-4"
                                />
                            )}

                            {/* Podcast Error */}
                            {podcastError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-bold"
                                >
                                    {podcastError}
                                </motion.div>
                            )}

                            <AnimatePresence initial={false}>
                                {messages.length === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50"
                                    >
                                        <div className="bg-primary/10 p-6 rounded-full">
                                            <MessageSquare className="h-12 w-12 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-black text-xl uppercase tracking-tighter">Start Your Study Session</p>
                                            <p className="text-sm font-medium">Ask your LevelUp Private Tutor anything about this material.</p>
                                        </div>
                                    </motion.div>
                                )}

                                {messages.map((m, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: m.role === "user" ? 20 : -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={cn(
                                            "flex gap-4 max-w-[85%] md:max-w-[70%]",
                                            m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                        )}
                                    >
                                        <Avatar className={cn(
                                            "h-10 w-10 border-2 shrink-0 shadow-sm",
                                            m.role === "assistant" ? "border-primary/20" : "border-secondary"
                                        )}>
                                            <AvatarFallback className={m.role === "assistant" ? "bg-primary text-white" : "bg-secondary"}>
                                                {m.role === "assistant" ? "AI" : "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-2">
                                            <div className={cn(
                                                "p-4 rounded-2xl shadow-sm text-sm font-medium leading-relaxed",
                                                m.role === "assistant"
                                                    ? "bg-card border border-border"
                                                    : "bg-primary text-primary-foreground"
                                            )}>
                                                {m.content}
                                            </div>

                                            {/* AI Evaluation Pill */}
                                            {m.role === "assistant" && m.evaluation && (
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="px-3 py-1 bg-violet-500/10 text-violet-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-violet-500/20">
                                                        {m.evaluation.thinkingCategory.replace('_', ' ')}
                                                    </span>
                                                    {m.evaluation.feedback && (
                                                        <p className="text-[10px] text-muted-foreground italic font-medium w-full mt-1">
                                                            "{m.evaluation.feedback}"
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {(isSending || isGeneratingPodcast) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-4 max-w-[70%] mr-auto items-center"
                                >
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary via-violet-500 to-primary animate-pulse border-2 border-primary/30 shadow-lg shadow-primary/20 flex items-center justify-center">
                                        <Brain className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-violet-500 to-primary rounded-2xl opacity-50 animate-pulse blur-sm"></div>
                                        <div className="relative bg-card border border-border px-5 py-3 rounded-2xl flex items-center gap-3 shadow-lg">
                                            <span className="text-xs font-black text-primary uppercase tracking-widest">
                                                {isGeneratingPodcast ? "LevelUp is Preparing Your Lesson" : "LevelUp AI is Thinking"}
                                            </span>
                                            <div className="flex gap-1">
                                                <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-6 shrink-0 bg-background">
                            <div className="max-w-4xl mx-auto relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-violet-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-focus-within:opacity-50"></div>
                                <div className="relative flex items-center gap-2 bg-card border-2 border-border p-2 rounded-2xl shadow-xl focus-within:border-primary/50 transition-all">
                                    <Input
                                        value={inputValue}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleSendMessage()}
                                        placeholder="ASK YOUR STUDY LIBRARY A QUESTION..."
                                        className="border-none bg-transparent h-12 font-bold tracking-tight focus-visible:ring-0 placeholder:text-muted-foreground/50"
                                        disabled={isSending}
                                    />
                                    <Button
                                        size="icon"
                                        onClick={() => handleSendMessage()}
                                        disabled={isSending || !inputValue.trim()}
                                        className="h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
                                    >
                                        <Send className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                            <p className="text-center text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-4 opacity-50">
                                Powered by your LevelUp Private Tutor.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center flex-1 p-10 text-center space-y-6">
                        <div className="bg-primary/5 p-12 rounded-full border-2 border-dashed border-primary/20">
                            <FileText className="h-20 w-20 text-primary opacity-20" />
                        </div>
                        <div className="max-w-sm">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-primary">Your Study Room</h2>
                            <p className="text-sm font-medium text-muted-foreground mt-2">
                                Select a document from your library to start a document-grounded Socratic tutoring session.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setIsAdding(true)}
                            className="border-2 border-primary/20 h-14 px-8 rounded-2xl font-black uppercase tracking-widest hover:bg-primary/5"
                        >
                            <Plus className="mr-2 h-5 w-5" />
                            Add Your First Notes
                        </Button>
                    </div>
                )}
            </main>

            {/* ── Add Material Modal ───────────────────────────── */}
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] bg-gradient-to-b from-card via-card to-card/95 border-2 border-primary/20 rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col">
                    {/* ── Fixed Header ── */}
                    <div className="shrink-0">
                        <DialogHeader className="p-8 pb-4">
                            <DialogTitle className="text-2xl font-black tracking-tighter uppercase text-primary">
                                Add Study Material
                            </DialogTitle>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Link a LevelUp Lab or paste text to begin studying</p>
                        </DialogHeader>

                        <div className="px-8 pb-4 space-y-4">

                            {/* ── LevelUp Lab Section ── */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-1.5">
                                        <FlaskConical className="h-3 w-3" />
                                        Link a LevelUp Lab
                                    </label>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                        onClick={fetchLabs}
                                        disabled={isLoadingLabs}
                                    >
                                        <RefreshCw className={cn("h-3 w-3", isLoadingLabs && "animate-spin")} />
                                    </Button>
                                </div>

                                {/* Session Dead Guard */}
                                {sessionDead ? (
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20">
                                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-amber-600">{sessionMessage}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="shrink-0 bg-gradient-to-r from-primary to-violet-600 text-white font-black text-[9px] uppercase tracking-widest rounded-full h-8 px-4 shadow-lg"
                                            onClick={() => {
                                                window.open("https://accounts.google.com", "_blank");
                                                setTimeout(fetchLabs, 5000);
                                            }}
                                        >
                                            <Link className="h-3 w-3 mr-1.5" />
                                            Re-link Account
                                        </Button>
                                    </div>
                                ) : isLoadingLabs ? (
                                    <div className="flex items-center justify-center p-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        <span className="text-xs font-bold text-muted-foreground ml-2">Loading labs...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Lab Dropdown */}
                                        <select
                                            value={selectedLabId}
                                            onChange={(e) => setSelectedLabId(e.target.value)}
                                            className="w-full h-12 bg-background border-2 border-border rounded-2xl px-4 font-bold text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">— Select an existing lab —</option>
                                            {labs.map(lab => (
                                                <option key={lab.id} value={lab.id}>
                                                    {lab.name}
                                                </option>
                                            ))}
                                        </select>

                                        {/* Create New Lab */}
                                        <div className="flex gap-2">
                                            <Input
                                                value={newLabName}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLabName(e.target.value)}
                                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && handleCreateLab()}
                                                placeholder="New lab name (e.g., ENGLISH 101)"
                                                className="flex-1 h-10 bg-background border-2 border-border rounded-xl font-bold text-xs placeholder:opacity-30"
                                                disabled={isCreatingLab}
                                            />
                                            <Button
                                                onClick={handleCreateLab}
                                                disabled={isCreatingLab || !newLabName.trim()}
                                                size="sm"
                                                className="h-10 px-4 rounded-xl bg-primary/10 text-primary font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all gap-1.5"
                                            >
                                                {isCreatingLab ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <>
                                                        <FlaskConical className="h-3 w-3" />
                                                        Create Lab
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                                <div className="relative flex justify-center text-[9px] uppercase font-black"><span className="bg-card px-2 text-muted-foreground">Or Paste Content</span></div>
                            </div>

                            {/* File Upload Dropzone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group relative overflow-hidden",
                                    isDragging ? "border-primary bg-primary/5 scale-[0.99]" : "border-border hover:border-primary/40 hover:bg-secondary/30"
                                )}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp"
                                    onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])}
                                />
                                <div className={cn(
                                    "p-3 rounded-xl bg-secondary group-hover:bg-primary/20 transition-colors",
                                    isDragging && "bg-primary text-white"
                                )}>
                                    {isReading ? (
                                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                                    ) : (
                                        <UploadCloud className={cn("h-6 w-6 text-muted-foreground group-hover:text-primary", isDragging && "text-white")} />
                                    )}
                                </div>
                                <div className="text-center">
                                    <p className="font-black text-sm uppercase tracking-tight text-primary">
                                        {isReading ? "Reading Content..." : "Drop your file here"}
                                    </p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                        .TXT · .MD · .PDF · .PNG · .JPG
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isReading}
                                    className="rounded-full font-black text-[9px] uppercase tracking-widest h-7 px-4 shadow-sm"
                                >
                                    {isReading ? "PROCESSING..." : "Browse Files"}
                                </Button>
                            </div>

                            {/* Upload Progress Bar */}
                            {uploadStatus && (
                                <div className="space-y-2">
                                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: '0%' }}
                                            animate={{ width: isReading ? '60%' : '100%' }}
                                            transition={{ duration: isReading ? 2 : 0.3, ease: 'easeInOut' }}
                                            className={cn(
                                                "h-full rounded-full",
                                                uploadStatus.startsWith("✅") ? "bg-emerald-500" :
                                                    uploadStatus.startsWith("⚠") ? "bg-amber-500" :
                                                        "bg-primary"
                                            )}
                                        />
                                    </div>
                                    <p className={cn(
                                        "text-[10px] font-bold text-center",
                                        uploadStatus.startsWith("✅") ? "text-emerald-600" :
                                            uploadStatus.startsWith("⚠") ? "text-amber-600" :
                                                "text-primary"
                                    )}>
                                        {isReading && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
                                        {uploadStatus}
                                    </p>
                                </div>
                            )}

                            {/* Document Title Input */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Document Title</label>
                                <Input
                                    placeholder="E.G., UNIT 4: QUANTUM PHYSICS NOTES"
                                    value={newTitle}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
                                    className="h-12 bg-background border-2 border-border focus-visible:ring-primary/20 font-bold rounded-2xl placeholder:opacity-30"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Scrollable Content Area (Textarea Only) ── */}
                    <div className="flex-1 overflow-y-auto px-8 pb-4 min-h-0">
                        <Textarea
                            placeholder="PASTE CONTENT OR UPLOAD A FILE ABOVE..."
                            value={newContent}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewContent(e.target.value)}
                            className="min-h-[180px] h-full bg-background border-2 border-border focus-visible:ring-primary/20 font-medium rounded-2xl resize-none p-6 leading-relaxed"
                        />
                    </div>

                    {/* ── Sticky Footer ── */}
                    <DialogFooter className="p-6 flex gap-3 border-t border-border/50 bg-card/80 backdrop-blur-md shrink-0">
                        <Button
                            variant="ghost"
                            onClick={() => setIsAdding(false)}
                            className="font-bold flex-1 h-12 rounded-2xl hover:bg-secondary"
                        >
                            CANCEL
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={loading || !newTitle || (!newContent && !selectedLabId)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black flex-1 h-12 rounded-2xl shadow-xl shadow-primary/20"
                        >
                            {(loading || isUploading) ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    {isUploading && <span className="ml-2 text-xs">Uploading to Lab...</span>}
                                </>
                            ) : "IMPORT TO LAB"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
