"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractTextFromPDF } from "@/lib/pdf-utils";
import { motion, AnimatePresence } from "framer-motion";
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Chat state
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

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

    const handleAddMaterial = async () => {
        if (!newTitle.trim() || !newContent.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setLoading(true);
        const { data, error } = await supabase
            .from("study_materials")
            .insert({
                user_id: user.id,
                title: newTitle,
                content: newContent,
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
            setMessages([]); // Clear chat for new material
        }
        setLoading(false);
    };

    const handleFileRead = async (file: File) => {
        if (!file) return;

        setIsReading(true);
        setUploadStatus("");

        // Auto-fill title from filename
        if (!newTitle) {
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            setNewTitle(baseName.toUpperCase());
        }

        const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

        try {
            if (isPdf) {
                setUploadStatus("Extracting text from PDF... This may take a moment.");
                const text = await extractTextFromPDF(file);
                if (!text || text.length < 10) {
                    setUploadStatus("⚠️ PDF had very little extractable text. Try copy-pasting manually.");
                } else {
                    setUploadStatus(`✅ Extracted ${text.length.toLocaleString()} characters from ${file.name}`);
                }
                setNewContent(text);
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
                `❌ Failed to extract text from "${file.name}".\n\n` +
                `This can happen with scanned PDFs or complex layouts.\n\n` +
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

    const QUICK_ACTIONS = [
        { id: "summary", label: "Summary", icon: FileSearch, prompt: "Summarize this document in 5 key bullet points.", color: "text-blue-500", bg: "bg-blue-500/10" },
        { id: "quiz", label: "Quick Quiz", icon: ListChecks, prompt: "Generate a 3-question multiple-choice quiz based on this text.", color: "text-amber-500", bg: "bg-amber-500/10" },
        { id: "podcast", label: "Podcast Script", icon: Mic, prompt: "Write an engaging, fun podcast script between two hosts (Host A and Host B) discussing the main ideas of this document.", color: "text-violet-500", bg: "bg-violet-500/10" },
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
                        <h2 className="font-black text-lg tracking-tight uppercase">Library</h2>
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
                                        Socratic Study Mode Active
                                    </div>
                                </div>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-success/10 rounded-full">
                                <Sparkles className="h-4 w-4 text-success" />
                                <span className="text-[10px] font-black text-success uppercase">Document Grounded</span>
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
                        </div>

                        {/* Messages Area */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
                        >
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
                                            <p className="font-black text-xl uppercase tracking-tighter">Start the conversation</p>
                                            <p className="text-sm font-medium">Ask me anything specifically about your notes.</p>
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
                            {isSending && (
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
                                            <span className="text-xs font-black text-primary uppercase tracking-widest">AI is Thinking</span>
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
                                        placeholder="ASK YOUR MATERIAL A QUESTION..."
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
                                Trained to remain strict to the provided text.
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
                    {/* ── Fixed Header (Title + Dropzone + Doc Input) ── */}
                    <div className="shrink-0">
                        <DialogHeader className="p-8 pb-4">
                            <DialogTitle className="text-2xl font-black tracking-tighter uppercase text-primary">
                                Add Study Material
                            </DialogTitle>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Upload a file or paste text to begin studying</p>
                        </DialogHeader>

                        <div className="px-8 pb-4 space-y-4">
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
                                    accept=".txt,.md,.csv,.json,.pdf"
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
                                        .TXT · .MD · .CSV · .PDF
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

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                                <div className="relative flex justify-center text-[9px] uppercase font-black"><span className="bg-card px-2 text-muted-foreground">Content</span></div>
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
                            onClick={handleAddMaterial}
                            disabled={loading || !newTitle || !newContent}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black flex-1 h-12 rounded-2xl shadow-xl shadow-primary/20"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "IMPORT TO LAB"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
