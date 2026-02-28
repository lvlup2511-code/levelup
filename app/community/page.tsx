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
    X,
    Trophy,
    Share2,
    MessageCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { Profile, Friendship, FriendshipStatus } from "@/lib/supabase/types";

type Tab = "friends" | "pending" | "add";

export default function CommunityPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>("friends");
    const [friends, setFriends] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    const supabase = createClient();

    const [existingFriendships, setExistingFriendships] = useState<Record<string, { status: FriendshipStatus; isReceiver: boolean; friendshipId?: number }>>({});

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }
        setCurrentUser(user);

        // 1. Fetch all friendships for current user to build a status map
        const { data: allFriendships } = await supabase
            .from("friendships")
            .select("id, requester_id, addressee_id, status")
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

        const statusMap: Record<string, { status: FriendshipStatus; isReceiver: boolean; friendshipId?: number }> = {};
        if (allFriendships) {
            allFriendships.forEach(f => {
                const isReceiver = f.addressee_id === user.id;
                const otherId = isReceiver ? f.requester_id : f.addressee_id;
                statusMap[otherId] = {
                    status: f.status as FriendshipStatus,
                    isReceiver: isReceiver && f.status === "pending",
                    friendshipId: f.id
                };
            });
        }
        setExistingFriendships(statusMap);

        // 2. Fetch Friends (Accepted) - Robust 2-step process
        const { data: friendData } = await supabase
            .from("friendships")
            .select("id, requester_id, addressee_id")
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
            .eq("status", "accepted");

        if (friendData && friendData.length > 0) {
            const friendIds = friendData.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
            const { data: profiles } = await supabase
                .from("profiles")
                .select("*")
                .in("id", friendIds);

            if (profiles) {
                // Map profiles back to their friendship IDs
                const friendsWithProfiles = friendData.map(f => {
                    const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
                    const profile = profiles.find(p => p.id === otherId);
                    return { ...f, profile };
                }).filter(f => !!f.profile);
                setFriends(friendsWithProfiles);
            }
        } else {
            setFriends([]);
        }

        // 3. Fetch Pending Requests (Incoming only)
        const { data: pendingData } = await supabase
            .from("friendships")
            .select(`
                *,
                requester:profiles!friendships_requester_id_fkey(*)
            `)
            .eq("addressee_id", user.id)
            .eq("status", "pending");

        setPendingRequests(pendingData || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSearch = async () => {
        const query = searchQuery.trim();
        if (!query) return;

        // Ensure we have current user to exclude self
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUser(user);

        setSearching(true);
        // Use wildcards for partial matching
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .ilike("username", `%${query}%`)
            .neq("id", user.id)
            .limit(10);

        if (error) {
            console.error("Search error:", error);
            alert("Search failed. Plase check your connection.");
        }
        setSearchResults(data || []);
        setSearching(false);
    };

    const sendRequest = async (targetUserId: string) => {
        setSearching(true); // Re-use searching to show spinner if needed
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            alert("Please login again to send friend requests.");
            setSearching(false);
            return;
        }

        const { error } = await supabase
            .from("friendships")
            .insert({
                requester_id: user.id,
                addressee_id: targetUserId,
                status: "pending"
            });

        if (error) {
            console.error("Add friend error:", error);
            alert(error.message || "Failed to send request. Maybe one already exists?");
        } else {
            alert("Request Sent!");
            // Refresh local status map
            setExistingFriendships(prev => ({ ...prev, [targetUserId]: { status: "pending", isReceiver: false } }));
            // Remove from search results to provide feedback
            setSearchResults(prev => prev.filter(p => p.id !== targetUserId));
        }
        setSearching(false);
    };

    const updateStatus = async (friendshipId: number, status: "accepted" | "declined") => {
        let error;
        if (status === "declined") {
            const result = await supabase.from("friendships").delete().eq("id", friendshipId);
            error = result.error;
        } else {
            const result = await supabase.from("friendships").update({ status }).eq("id", friendshipId);
            error = result.error;
        }

        if (error) {
            alert("Action failed: " + error.message);
        } else {
            fetchData();
        }
    };

    const handleShare = () => {
        const text = `Join my squad on LevelUp! 🚀 Let's learn and compete together: ${window.location.origin}`;
        navigator.clipboard.writeText(text);
        alert("Invite link copied to clipboard! 🚀 Share it with your friends.");
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

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
                <Button
                    onClick={() => router.push("/leaderboard")}
                    className="bg-primary text-primary-foreground font-black uppercase tracking-tight rounded-2xl h-12 shadow-lg"
                >
                    <Trophy className="mr-2 h-5 w-5" />
                    Leaderboard
                </Button>
                <Button
                    onClick={handleShare}
                    variant="outline"
                    className="border-2 border-primary/20 font-black uppercase tracking-tight rounded-2xl h-12"
                >
                    <Share2 className="mr-2 h-5 w-5 text-primary" />
                    Invite
                </Button>
            </div>

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
                                (friends as any[]).map(f => {
                                    const friend = f.profile;
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
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary rounded-xl" onClick={() => router.push(`/chat/${friend.id}`)}>
                                                        <MessageCircle className="h-5 w-5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive rounded-xl" onClick={() => updateStatus(f.id, "declined")}>
                                                        <UserX className="h-5 w-5" />
                                                    </Button>
                                                </div>
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
                                {searchResults.map(p => {
                                    const status = existingFriendships[p.id];
                                    return (
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
                                                {status?.status === "accepted" ? (
                                                    <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-xl font-black text-xs uppercase tracking-wider">
                                                        <UserCheck className="h-4 w-4" />
                                                        Friends
                                                    </div>
                                                ) : status?.isReceiver ? (
                                                    <div className="flex gap-2">
                                                        <Button size="sm" className="bg-success hover:bg-success/90 rounded-xl px-4" onClick={() => updateStatus(status.friendshipId!, "accepted")}>
                                                            <Check className="h-4 w-4 mr-1" />
                                                            Accept
                                                        </Button>
                                                        <Button size="sm" variant="destructive" className="rounded-xl px-4" onClick={() => updateStatus(status.friendshipId!, "declined")}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : status?.status === "pending" ? (
                                                    <div className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500/10 text-yellow-600 rounded-xl font-black text-xs uppercase tracking-wider">
                                                        <Clock className="h-4 w-4" />
                                                        Pending
                                                    </div>
                                                ) : (
                                                    <Button className="rounded-2xl gap-2 font-black h-12 px-6 shadow-md" onClick={() => sendRequest(p.id)}>
                                                        <UserPlus className="h-5 w-5" />
                                                        ADD
                                                    </Button>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
