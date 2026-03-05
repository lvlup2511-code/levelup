"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    Send,
    Loader2,
    Wifi,
    WifiOff,
    Sparkles,
    Check,
    CheckCheck,
    Volume2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DirectMessage } from "@/lib/supabase/types";

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string): string {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function ConversationPage() {
    const router = useRouter();
    const params = useParams();
    const friendId = params.friendId as string;
    const supabase = createClient();

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [friendProfile, setFriendProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const [isReadReceiptsSupported, setIsReadReceiptsSupported] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({
            behavior: smooth ? "smooth" : "instant",
        });
    }, []);

    // 1. Fetch initial data
    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }
            setCurrentUserId(user.id);

            // Fetch friend profile
            const { data: profile } = await supabase
                .from("profiles")
                .select("username, avatar_url")
                .eq("id", friendId)
                .single();

            if (profile) setFriendProfile(profile);

            // Fetch conversation via RPC
            const { data: msgs, error } = await supabase.rpc("get_conversation", {
                p_friend_id: friendId,
            });

            if (!error && msgs) {
                setMessages(msgs as DirectMessage[]);
            }

            // Mark messages from this friend as read
            await supabase.rpc("mark_messages_read", { p_sender_id: friendId });

            setLoading(false);
        }
        init();
    }, [friendId, router, supabase]);

    // 2. Scroll to bottom when messages load or change
    useEffect(() => {
        if (!loading) {
            scrollToBottom(messages.length > 0);
        }
    }, [loading, messages.length, scrollToBottom]);

    // 3. Supabase Realtime subscription
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`dm:${[currentUserId, friendId].sort().join("-")}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "direct_messages",
                    filter: `receiver_id=eq.${currentUserId}`,
                },
                (payload) => {
                    const newMsg = payload.new as DirectMessage;
                    if (newMsg.sender_id === friendId) {
                        setMessages((prev) => {
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });
                        supabase.rpc("mark_messages_read", { p_sender_id: friendId });
                    }
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "direct_messages",
                    filter: `sender_id=eq.${currentUserId}`,
                },
                (payload) => {
                    const updatedMsg = payload.new as DirectMessage;
                    setMessages((prev) =>
                        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
                    );
                }
            )
            .subscribe((status) => {
                setRealtimeConnected(status === "SUBSCRIBED");
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId, friendId, supabase]);

    // 4. Send message
    const handleSend = async () => {
        const text = newMessage.trim();
        if (!text || !currentUserId || sending) return;

        setSending(true);
        setNewMessage("");

        // Optimistic insert
        const optimisticMsg: DirectMessage = {
            id: Date.now(), // Temporary ID
            sender_id: currentUserId,
            receiver_id: friendId,
            content: text,
            is_read: false,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        scrollToBottom(true);

        const { data, error } = await supabase
            .from("direct_messages")
            .insert({
                sender_id: currentUserId,
                receiver_id: friendId,
                content: text,
            })
            .select()
            .single();

        if (error) {
            // Remove optimistic message on error
            setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
            setNewMessage(text); // Restore the message
        } else if (data) {
            // Replace optimistic with real message
            setMessages((prev) =>
                prev.map((m) => (m.id === optimisticMsg.id ? (data as DirectMessage) : m))
            );
        }
        setSending(false);
        inputRef.current?.focus();
    };

    // Handle Enter key (Shift+Enter for newline)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // 5. Summon Gemini (AI Content Generation)
    const summonGemini = async () => {
        if (aiLoading) return;
        setAiLoading(true);

        try {
            // Take the last 4 messages as context
            const context = messages.slice(-4).map(m => ({
                role: m.sender_id === currentUserId ? "user" : "assistant",
                content: m.content
            }));

            // If context is empty, just ask for a generic greeting/icebreaker
            if (context.length === 0) {
                context.push({ role: "user", content: `Say hello to ${friendProfile?.username}!` });
            }

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: context })
            });

            const data = await res.json();
            if (data.reply) {
                setNewMessage(`🤖 Gemini: ${data.reply}`);
                // Focus the input
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        } catch (error) {
            console.error("AI Assistant Error:", error);
        } finally {
            setAiLoading(false);
        }
    };

    // 6. Voice Assistant (TTS)
    const speakText = (text: string) => {
        if (!window.speechSynthesis) return;

        // Clean up text (remove emoji prefix if present)
        const cleanText = text.replace(/^🤖 Gemini:\s*/i, "");

        // Cancel any existing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        // Try to find a nice English voice or just use default
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) ||
            voices.find(v => v.lang.startsWith("en"));

        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
    };

    // Group messages by date
    const groupedMessages: { date: string; messages: DirectMessage[] }[] = [];
    let currentDate = "";
    for (const msg of messages) {
        const msgDate = new Date(msg.created_at).toDateString();
        if (msgDate !== currentDate) {
            currentDate = msgDate;
            groupedMessages.push({ date: msg.created_at, messages: [msg] });
        } else {
            groupedMessages[groupedMessages.length - 1].messages.push(msg);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen max-w-7xl mx-auto w-full">
            {/* Chat Header */}
            <header className="sticky top-0 z-40 flex items-center gap-3 border-b-2 border-border bg-card/95 backdrop-blur px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/chat")}
                    className="rounded-full shrink-0"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarImage
                        src={friendProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friendProfile?.username}`}
                    />
                    <AvatarFallback>👦</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-foreground uppercase tracking-tight truncate">
                        {friendProfile?.username || "..."}
                    </p>
                    <div className="flex items-center gap-1">
                        {realtimeConnected ? (
                            <>
                                <Wifi className="h-3 w-3 text-green-500" />
                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">
                                    Live
                                </span>
                            </>
                        ) : (
                            <>
                                <WifiOff className="h-3 w-3 text-muted-foreground/50" />
                                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                                    Connecting...
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full px-4">
                        <div className="text-6xl mb-4">👋</div>
                        <p className="text-sm font-black text-muted-foreground uppercase tracking-wider text-center">
                            Say hello!
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1 text-center">
                            Start the conversation with {friendProfile?.username}
                        </p>
                    </div>
                ) : (
                    groupedMessages.map((group) => (
                        <div key={group.date}>
                            {/* Date Separator */}
                            <div className="flex items-center gap-3 my-4">
                                <div className="h-px flex-1 bg-border/60" />
                                <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                    {formatDateSeparator(group.date)}
                                </span>
                                <div className="h-px flex-1 bg-border/60" />
                            </div>

                            {/* Messages */}
                            {group.messages.map((msg, i) => {
                                const isMine = msg.sender_id === currentUserId;
                                const showTail =
                                    i === group.messages.length - 1 ||
                                    group.messages[i + 1]?.sender_id !== msg.sender_id;

                                return (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.15 }}
                                        className={cn(
                                            "flex mb-0.5",
                                            isMine ? "justify-end" : "justify-start",
                                            showTail && "mb-2"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[80%] px-4 py-2.5 text-sm leading-relaxed relative",
                                                isMine
                                                    ? cn(
                                                        "bg-primary text-primary-foreground",
                                                        showTail ? "rounded-2xl rounded-br-md" : "rounded-2xl"
                                                    )
                                                    : cn(
                                                        "bg-card border-2 border-border text-foreground",
                                                        showTail ? "rounded-2xl rounded-bl-md" : "rounded-2xl"
                                                    )
                                            )}
                                        >
                                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                <div className="flex items-center gap-1">
                                                    <p className={cn(
                                                        "text-[9px] font-bold uppercase tracking-wider",
                                                        isMine ? "text-primary-foreground/60" : "text-muted-foreground/50"
                                                    )}>
                                                        {formatTime(msg.created_at)}
                                                    </p>
                                                    {isMine && (
                                                        <div className="flex ml-1">
                                                            {msg.is_read ? (
                                                                <CheckCheck className="h-3 w-3 text-sky-300" />
                                                            ) : (
                                                                <Check className="h-3 w-3 text-primary-foreground/40" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                {msg.content.startsWith("🤖 Gemini:") && (
                                                    <button
                                                        onClick={() => speakText(msg.content)}
                                                        className={cn(
                                                            "p-1 rounded-md transition-colors",
                                                            isMine ? "hover:bg-primary-foreground/20 text-primary-foreground/80" : "hover:bg-primary/10 text-primary"
                                                        )}
                                                        title="Read Aloud"
                                                    >
                                                        <Volume2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="sticky bottom-0 border-t-2 border-border bg-card/95 backdrop-blur px-4 py-3">
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            className={cn(
                                "w-full resize-none rounded-2xl border-2 border-primary/20 bg-card px-4 py-3 pr-4",
                                "text-sm font-medium placeholder:text-muted-foreground/50",
                                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
                                "max-h-32 transition-all"
                            )}
                            style={{
                                height: "auto",
                                minHeight: "48px",
                                maxHeight: "128px",
                            }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = "auto";
                                target.style.height = Math.min(target.scrollHeight, 128) + "px";
                            }}
                        />
                    </div>
                    <Button
                        onClick={summonGemini}
                        disabled={aiLoading}
                        variant="outline"
                        size="icon"
                        className={cn(
                            "h-12 w-12 rounded-2xl shrink-0 border-2 border-primary/20",
                            aiLoading ? "animate-pulse" : "hover:bg-primary/5"
                        )}
                        title="Summon Gemini Assistant"
                    >
                        {aiLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : (
                            <Sparkles className="h-5 w-5 text-primary" />
                        )}
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        size="icon"
                        className={cn(
                            "h-12 w-12 rounded-2xl shrink-0 shadow-lg transition-all active:scale-90",
                            newMessage.trim()
                                ? "bg-primary hover:bg-primary/90"
                                : "bg-muted text-muted-foreground"
                        )}
                    >
                        {sending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-5 w-5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
