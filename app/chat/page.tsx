"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    MessageCircle,
    Loader2,
    Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatListItem {
    friend_id: string;
    friend_username: string;
    friend_avatar: string | null;
    last_message: string;
    last_message_at: string;
    unread_count: number;
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d`;
    return `${Math.floor(diffDay / 7)}w`;
}

export default function ChatInboxPage() {
    const router = useRouter();
    const supabase = createClient();

    const [chatList, setChatList] = useState<ChatListItem[]>([]);
    const [friendsWithoutChat, setFriendsWithoutChat] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchFilter, setSearchFilter] = useState("");

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push("/login");
            return;
        }

        try {
            // 1. Fetch active chats via RPC (Friends with message history)
            const { data: chats } = await supabase.rpc("get_chat_list");
            const activeChats = (chats || []) as ChatListItem[];
            setChatList(activeChats);

            // 2. Fetch ALL accepted friend IDs (using a basic query for reliability)
            const { data: friendships, error: friendError } = await supabase
                .from("friendships")
                .select("requester_id, addressee_id")
                .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
                .eq("status", "accepted");

            if (friendError) throw friendError;

            if (friendships && friendships.length > 0) {
                // Determine the IDs of the friends
                const friendIds = friendships.map(f =>
                    f.requester_id === user.id ? f.addressee_id : f.requester_id
                );

                // 3. Fetch profiles for these friend IDs
                const { data: profiles, error: profileError } = await supabase
                    .from("profiles")
                    .select("id, username, avatar_url")
                    .in("id", friendIds);

                if (profileError) throw profileError;

                if (profiles) {
                    const chatFriendIds = new Set(activeChats.map(c => c.friend_id));
                    // Filter to only include friends NOT already in the active chat list
                    const newFriends = profiles.filter(p => !chatFriendIds.has(p.id));
                    setFriendsWithoutChat(newFriends);
                }
            } else {
                setFriendsWithoutChat([]);
            }
        } catch (error) {
            console.error("Error fetching chat inbox:", error);
        } finally {
            setLoading(false);
        }
    }, [supabase, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredChats = chatList.filter(c =>
        c.friend_username?.toLowerCase().includes(searchFilter.toLowerCase())
    );
    const filteredNewFriends = friendsWithoutChat.filter(f =>
        f.username?.toLowerCase().includes(searchFilter.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-4 p-6 pt-8 pb-28 max-w-lg mx-auto min-h-screen">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">
                        MESSAGES
                    </h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest italic opacity-70">
                        Chat with your squad.
                    </p>
                </div>
                <div className="bg-primary/20 p-3 rounded-2xl">
                    <MessageCircle className="h-6 w-6 text-primary" />
                </div>
            </header>

            {/* Search */}
            <div className="relative">
                <Input
                    placeholder="Search friends..."
                    className="pl-10 h-12 bg-card border-2 border-primary/20 focus-visible:ring-primary/30 font-bold tracking-tight rounded-2xl"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>

            {/* Chat List */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key="chat-list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-2"
                    >
                        {/* Active conversations */}
                        {filteredChats.map((chat, i) => (
                            <motion.div
                                key={chat.friend_id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <button
                                    onClick={() => router.push(`/chat/${chat.friend_id}`)}
                                    className="w-full text-left"
                                >
                                    <Card className={cn(
                                        "border-2 transition-all hover:shadow-md hover:scale-[1.01]",
                                        chat.unread_count > 0
                                            ? "border-primary/30 bg-primary/5"
                                            : "border-border/60 bg-card/60 hover:border-primary/20"
                                    )}>
                                        <CardContent className="p-3 flex items-center gap-3">
                                            <div className="relative">
                                                <Avatar className="h-12 w-12 border-2 border-primary/20">
                                                    <AvatarImage src={chat.friend_avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${chat.friend_username}`} />
                                                    <AvatarFallback>👦</AvatarFallback>
                                                </Avatar>
                                                {chat.unread_count > 0 && (
                                                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground shadow-sm">
                                                        {chat.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={cn(
                                                        "text-sm truncate uppercase tracking-tight",
                                                        chat.unread_count > 0 ? "font-black text-foreground" : "font-bold text-foreground/80"
                                                    )}>
                                                        {chat.friend_username}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0">
                                                        {timeAgo(chat.last_message_at)}
                                                    </span>
                                                </div>
                                                <p className={cn(
                                                    "text-xs truncate mt-0.5",
                                                    chat.unread_count > 0 ? "font-semibold text-foreground/70" : "text-muted-foreground"
                                                )}>
                                                    {chat.last_message}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </button>
                            </motion.div>
                        ))}

                        {/* Friends with no messages yet */}
                        {filteredNewFriends.length > 0 && (
                            <>
                                <div className="flex items-center gap-2 pt-4 pb-1">
                                    <div className="h-px flex-1 bg-border" />
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        Start a conversation
                                    </span>
                                    <div className="h-px flex-1 bg-border" />
                                </div>
                                {filteredNewFriends.map((friend, i) => (
                                    <motion.div
                                        key={friend.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (filteredChats.length + i) * 0.05 }}
                                    >
                                        <button
                                            onClick={() => router.push(`/chat/${friend.id}`)}
                                            className="w-full text-left"
                                        >
                                            <Card className="border-2 border-dashed border-border/60 bg-transparent hover:border-primary/30 hover:bg-primary/5 transition-all">
                                                <CardContent className="p-3 flex items-center gap-3">
                                                    <Avatar className="h-12 w-12 border-2 border-border">
                                                        <AvatarImage src={friend.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.username}`} />
                                                        <AvatarFallback>👦</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-foreground/80 uppercase tracking-tight truncate">
                                                            {friend.username}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground italic">
                                                            Tap to say hello 👋
                                                        </p>
                                                    </div>
                                                    <MessageCircle className="h-5 w-5 text-muted-foreground/40" />
                                                </CardContent>
                                            </Card>
                                        </button>
                                    </motion.div>
                                ))}
                            </>
                        )}

                        {/* Empty state */}
                        {filteredChats.length === 0 && filteredNewFriends.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 px-4">
                                <MessageCircle className="h-16 w-16 text-muted-foreground/20 mb-4" />
                                <p className="text-sm font-black text-muted-foreground uppercase tracking-wider text-center">
                                    No conversations yet
                                </p>
                                <p className="text-xs text-muted-foreground/60 mt-1 text-center">
                                    Add friends from the Community page to start chatting!
                                </p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
}
