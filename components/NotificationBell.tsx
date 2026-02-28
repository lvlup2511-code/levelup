"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Bell,
    UserPlus,
    UserCheck,
    MessageCircle,
    Trophy,
    Star,
    Info,
    CheckCheck,
    X,
    Check,
    Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/lib/supabase/types";
import { motion, AnimatePresence } from "framer-motion";

const NOTIFICATION_ICON: Record<NotificationType, typeof Bell> = {
    friend_request: UserPlus,
    friend_accepted: UserCheck,
    direct_message: MessageCircle,
    mission_completed: Trophy,
    level_up: Star,
    system: Info,
};

const NOTIFICATION_COLOR: Record<NotificationType, string> = {
    friend_request: "text-blue-500 bg-blue-500/10",
    friend_accepted: "text-green-500 bg-green-500/10",
    direct_message: "text-purple-500 bg-purple-500/10",
    mission_completed: "text-yellow-500 bg-yellow-500/10",
    level_up: "text-orange-500 bg-orange-500/10",
    system: "text-gray-500 bg-gray-500/10",
};

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `${diffMin}د`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}س`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}ي`;
}

export function NotificationBell() {
    const supabase = createClient();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchUnreadCount = useCallback(async () => {
        const { data, error } = await supabase.rpc("get_unread_notification_count");
        if (!error && data !== null) {
            setUnreadCount(data as number);
        }
    }, [supabase]);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);

        if (!error && data) {
            setNotifications(data as Notification[]);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [open]);

    const handleToggle = () => {
        if (!open) {
            fetchNotifications();
        }
        setOpen(!open);
    };

    const markAllRead = async () => {
        await supabase.rpc("mark_all_notifications_read");
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const markOneRead = async (id: number) => {
        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id);
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    // Accept or decline a friend request directly from the notification
    const handleFriendAction = async (
        notification: Notification,
        action: "accepted" | "declined"
    ) => {
        const friendshipId = (notification.metadata as Record<string, unknown>)?.friendship_id;
        if (!friendshipId) return;

        setActionLoading(notification.id);

        if (action === "declined") {
            await supabase
                .from("friendships")
                .delete()
                .eq("id", friendshipId);
        } else {
            await supabase
                .from("friendships")
                .update({ status: "accepted" })
                .eq("id", friendshipId);
        }

        // Mark the notification as read & remove it from the list
        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", notification.id);

        setNotifications(prev => prev.filter(n => n.id !== notification.id));
        setUnreadCount(prev => Math.max(0, prev - 1));
        setActionLoading(null);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={handleToggle}
                className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                    open
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-label="Notifications"
            >
                <Bell className="h-5 w-5" strokeWidth={2} />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-black text-destructive-foreground shadow-md"
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full right-0 mb-2 w-80 max-h-[400px] overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl z-[100]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-border px-4 py-3">
                            <h3 className="font-black text-sm uppercase tracking-wider text-foreground">
                                Notifications
                            </h3>
                            <div className="flex items-center gap-1">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors uppercase tracking-wider"
                                    >
                                        <CheckCheck className="h-3 w-3" />
                                        Read All
                                    </button>
                                )}
                                <button
                                    onClick={() => setOpen(false)}
                                    className="rounded-lg p-1 text-muted-foreground hover:bg-secondary transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div className="overflow-y-auto max-h-[340px]">
                            {loading ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 px-4">
                                    <Bell className="h-10 w-10 text-muted-foreground/30 mb-2" />
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">
                                        No notifications yet
                                    </p>
                                </div>
                            ) : (
                                notifications.map((notification) => {
                                    const Icon = NOTIFICATION_ICON[notification.type] || Bell;
                                    const colorClass = NOTIFICATION_COLOR[notification.type] || "text-gray-500 bg-gray-500/10";
                                    const [iconText, iconBg] = colorClass.split(" ");
                                    const isFriendRequest = notification.type === "friend_request";
                                    const isActioning = actionLoading === notification.id;

                                    return (
                                        <div
                                            key={notification.id}
                                            className={cn(
                                                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-b-0",
                                                !notification.is_read && "bg-primary/5"
                                            )}
                                        >
                                            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl mt-0.5", iconBg)}>
                                                <Icon className={cn("h-4 w-4", iconText)} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={cn(
                                                        "text-xs truncate",
                                                        !notification.is_read ? "font-black text-foreground" : "font-semibold text-muted-foreground"
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0">
                                                        {timeAgo(notification.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                    {notification.content}
                                                </p>

                                                {/* Friend Request Action Buttons */}
                                                {isFriendRequest && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        {isActioning ? (
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                Processing...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleFriendAction(notification, "accepted");
                                                                    }}
                                                                    className="flex items-center gap-1 rounded-lg bg-green-500/15 px-3 py-1.5 text-[10px] font-black text-green-600 uppercase tracking-wider hover:bg-green-500/25 transition-colors"
                                                                >
                                                                    <Check className="h-3 w-3" />
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleFriendAction(notification, "declined");
                                                                    }}
                                                                    className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-500 uppercase tracking-wider hover:bg-red-500/20 transition-colors"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                    Decline
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {!notification.is_read && !isFriendRequest && (
                                                <button
                                                    onClick={() => markOneRead(notification.id)}
                                                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary hover:ring-2 hover:ring-primary/30 transition-all"
                                                    aria-label="Mark as read"
                                                />
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

