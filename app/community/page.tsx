"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Users,
    UserPlus,
    UserCheck,
    UserX,
    Search,
    Clock,
    ShieldAlert,
    Loader2,
    Check,
    X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Profile, Friendship } from "@/lib/supabase/types";

type Tab = "friends" | "pending" | "add";

export default function CommunityPage() {
    const [activeTab, setActiveTab] = useState<Tab>("friends");
    const [friends, setFriends] = useState<Friendship[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    const supabase = createClient();

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUser(user);

        // 1. Fetch Friends (Accepted)
        const { data: acceptedData } = await supabase
            .from("friendships")
            .select(`
        *,
        requester:profiles!friendships_requester_id_fkey(*),
        addressee:profiles!friendships_addressee_id_fkey(*)
      `)
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
            .eq("status", "accepted");

        // 2. Fetch Pending Requests
        const { data: pendingData } = await supabase
            .from("friendships")
            .select(`
        *,
        requester:profiles!friendships_requester_id_fkey(*),
        addressee:profiles!friendships_addressee_id_fkey(*)
      `)
            .eq("addressee_id", user.id)
            .eq("status", "pending");

        setFriends(acceptedData || []);
        setPendingRequests(pendingData || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .ilike("username", searchQuery.trim())
            .neq("id", currentUser?.id)
            .limit(5);

        setSearchResults(data || []);
        setSearching(false);
    };

    const sendRequest = async (targetUserId: string) => {
        const { error } = await supabase
            .from("friendships")
            .insert({
                requester_id: currentUser.id,
                addressee_id: targetUserId,
                status: "pending"
            });

        if (!error) {
            alert("Request Sent!");
            setSearchResults(prev => prev.filter(p => p.id !== targetUserId));
        }
    };

    const updateStatus = async (friendshipId: number, status: "accepted" | "declined") => {
        if (status === "declined") {
            await supabase.from("friendships").delete().eq("id", friendshipId);
        } else {
            await supabase.from("friendships").update({ status }).eq("id", friendshipId);
        }
        fetchData();
    };

    const TabButton = ({ id, label, icon: Icon, count }: { id: Tab, label: string, icon: any, count?: number }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={cn(
                "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold transition-all border-b-2",
                activeTab === id
                    ? "text-primary border-primary bg-primary/5"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/50"
            )}
        >
            <Icon className="h-4 w-4" />
            {label}
            {count !== undefined && count > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {count}
                </span>
            )}
        </button>
    );

    return (
        <div className="flex flex-col gap-6 p-6 pt-8 max-w-lg mx-auto pb-24 h-screen overflow-hidden">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">
                        COMMUNITY
                    </h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest italic opacity-70">
                        Connect. Compete. Level Up.
                    </p>
                </div>
                <div className="bg-primary/20 p-3 rounded-2xl">
                    <Users className="h-6 w-6 text-primary" />
                </div>
            </header>

            <div className="flex rounded-xl overflow-hidden border border-border bg-card">
                <TabButton id="friends" label="Friends" icon={UserCheck} />
                <TabButton id="pending" label="Pending" icon={Clock} count={pendingRequests.length} />
                <TabButton id="add" label="Add" icon={UserPlus} />
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
                <AnimatePresence mode="wait">
                    {activeTab === "friends" && (
                        <motion.div
                            key="friends"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-3"
                        >
                            {loading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
                            ) : friends.length === 0 ? (
                                <Card className="border-dashed py-10 text-center bg-transparent">
                                    <p className="text-sm font-bold text-muted-foreground uppercase italic px-4">You have no friends yet. Time to recruit your squad!</p>
                                </Card>
                            ) : (
                                friends.map(f => {
                                    const friend = f.requester_id === currentUser?.id ? f.addressee : f.requester;
                                    if (!friend) return null;
                                    return (
                                        <Card key={f.id} className="border-2 border-primary/10 hover:border-primary/30 transition-all bg-card/60 backdrop-blur-sm">
                                            <CardContent className="p-3 flex items-center gap-3">
                                                <Avatar className="h-12 w-12 border-2 border-primary/20">
                                                    <AvatarImage src={friend.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.username}`} />
                                                    <AvatarFallback>👦</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-foreground uppercase tracking-tight truncate">{friend.username}</p>
                                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">{friend.xp_points} XP • LVL {Math.floor(friend.xp_points / 500) + 1}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive rounded-xl" onClick={() => updateStatus(f.id, "declined")}>
                                                    <UserX className="h-5 w-5" />
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </motion.div>
                    )}

                    {activeTab === "pending" && (
                        <motion.div
                            key="pending"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-3"
                        >
                            {pendingRequests.length === 0 ? (
                                <Card className="border-dashed py-10 text-center bg-transparent">
                                    <p className="text-sm font-bold text-muted-foreground uppercase italic px-4">No pending invites. You're all caught up!</p>
                                </Card>
                            ) : (
                                pendingRequests.map(f => (
                                    <Card key={f.id} className="border-2 border-yellow-400/20 bg-yellow-400/5 backdrop-blur-sm">
                                        <CardContent className="p-3 flex items-center gap-3">
                                            <Avatar className="h-12 w-12 border-2 border-yellow-400/30">
                                                <AvatarImage src={f.requester?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${f.requester?.username}`} />
                                                <AvatarFallback>👦</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-foreground uppercase tracking-tight truncate">{f.requester?.username}</p>
                                                <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider">Sent you a request</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="icon" className="bg-success hover:bg-success/90 rounded-xl" onClick={() => updateStatus(f.id, "accepted")}>
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="destructive" className="rounded-xl" onClick={() => updateStatus(f.id, "declined")}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </motion.div>
                    )}

                    {activeTab === "add" && (
                        <motion.div
                            key="add"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <div className="relative">
                                <Input
                                    placeholder="SEARCH USERNAME..."
                                    className="pl-10 h-14 bg-card border-2 border-primary/20 focus-visible:ring-primary/30 font-black tracking-tight rounded-2xl"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                />
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Button
                                    size="sm"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-4 rounded-xl font-bold"
                                    onClick={handleSearch}
                                    disabled={searching}
                                >
                                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "SEARCH"}
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {searchResults.map(p => (
                                    <Card key={p.id} className="border-2 border-dashed border-primary/20 hover:border-solid hover:border-primary/40 transition-all bg-transparent">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <Avatar className="h-14 w-14 border-2 border-primary/30">
                                                <AvatarImage src={p.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.username}`} />
                                                <AvatarFallback>👦</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="text-lg font-black text-foreground uppercase tracking-tighter leading-none mb-1">{p.username}</p>
                                                <p className="text-xs font-bold text-muted-foreground uppercase opacity-70">LVL {Math.floor(p.xp_points / 500) + 1}</p>
                                            </div>
                                            <Button className="rounded-2xl gap-2 font-black h-12 px-6 shadow-md" onClick={() => sendRequest(p.id)}>
                                                <UserPlus className="h-5 w-5" />
                                                ADD
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
