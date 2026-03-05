"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bot, Camera, Mic, Send, X, Loader2, Volume2, VolumeX, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { calculateXpAward } from "@/lib/gamification";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import OutOfEnergyModal from "@/components/OutOfEnergyModal";

type MessageRole = "user" | "assistant";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  imageUrl?: string;
};

function getInitials(name: string | null, id: string): string {
  if (name && name.length >= 2) return name.slice(0, 2).toUpperCase();
  return id.slice(0, 2).toUpperCase();
}

export default function QuestPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "أهلاً بك يا بطل في LevelUp! أنا المدرس الذكي بتاعك. ابعتلي أي سؤال أو صور الواجب بتاعك وهشرحلك خطوة بخطوة.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userInitials, setUserInitials] = useState("YOU");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // 🔴 حالة تفعيل الصوت
  const [xpFeedback, setXpFeedback] = useState<number | null>(null); // 🟢 تغذية راجعة لـ XP
  const [leveledUp, setLeveledUp] = useState(false); // 🎊 ليفل أب
  const [newLevelNum, setNewLevelNum] = useState<number>(1); // 📈 المستوى الجديد
  const [showOutOfEnergy, setShowOutOfEnergy] = useState(false); // 🔋 نفدت الطاقة

  const { transcript, isListening, startListening, stopListening, isSupported } = useSpeechToText("ar-SA");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // تحديث الإدخال وقت ما الطالب بيتكلم
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  // إخفاء الـ XP toast بعد ثانيتين
  useEffect(() => {
    if (xpFeedback) {
      const timer = setTimeout(() => setXpFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [xpFeedback]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserInitials((user.user_metadata?.username || user.email || "YOU").slice(0, 2).toUpperCase());
      const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
      if (profile?.username) setUserInitials(getInitials(profile.username, user.id));
    })();
  }, [supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔴 دالة النطق الصوتي
  const speakText = (text: string) => {
    if (!voiceEnabled) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // إيقاف أي صوت قديم
      // تنظيف النص من علامات الماركداون عشان النطق يكون سليم
      const cleanText = text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ar-SA'; // اللهجة العربية
      utterance.rate = 1.05; // سرعة الصوت
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !pendingFile) return;

    // إيقاف الصوت لو الطالب بعت رسالة جديدة
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    setInput("");
    let imageBase64: string | undefined;
    if (pendingFile) {
      const reader = new FileReader();
      reader.readAsDataURL(pendingFile);
      imageBase64 = await new Promise<string>((res) => {
        reader.onload = () => res(String(reader.result));
      });
      setPreviewUrl(null);
      setPendingFile(null);
    }
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text || "(تم إرفاق صورة)",
      imageUrl: imageBase64,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const allMessagesInOrder = [...messages, userMsg];
      const payload = {
        messages: allMessagesInOrder.map((m) => ({ role: m.role, content: m.content })),
        image: imageBase64 ?? undefined,
        isVoice: isListening, // 🎤 Pass voice status
      };
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // 🔋 Rate limit check
      if (res.status === 429) {
        setShowOutOfEnergy(true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      const reply = data.reply ?? data.error ?? "عذراً، لم أتمكن من المعالجة. حاول مرة أخرى.";

      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, role: "assistant", content: reply },
      ]);

      // 🔴 نطق الرد فوراً بعد استلامه
      speakText(reply);

      // 🟢 منح نقاط الـ XP للـ Hero
      try {
        const xpAmount = calculateXpAward(!!imageBase64);
        const xpRes = await fetch("/api/xp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xpAmount }),
        });
        const xpData = await xpRes.json();
        if (xpData.xpAwarded) {
          setXpFeedback(xpData.xpAwarded);
          if (xpData.leveledUp) {
            setNewLevelNum(xpData.newLevel);
            setLeveledUp(true);

            // 🎊 تشغيل الكونفيتي
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#0EA5E9', '#10B981', '#F59E0B']
            });

            setTimeout(() => setLeveledUp(false), 5000); // إخفاء احتفالية الليفل بعد 5 ثواني
          }
        }
      } catch (e) {
        console.error("XP Error:", e);
      }

    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, role: "assistant", content: "حدث خطأ ما. يرجى المحاولة لاحقاً." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const removeImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if (voiceEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col bg-background max-w-7xl mx-auto w-full relative overflow-hidden">
      {/* 🟢 XP Toast */}
      <AnimatePresence>
        {xpFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%", scale: 0.8 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: -40, x: "-50%", scale: 0.8 }}
            className="absolute top-20 left-1/2 z-[60] bg-success text-success-foreground px-6 py-2.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 font-bold border-2 border-white/20 backdrop-blur-sm"
          >
            <div className="bg-white/20 rounded-full p-1">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg">+{xpFeedback} XP Gained!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎊 Level Up Celebration */}
      <AnimatePresence>
        {leveledUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-background/40 backdrop-blur-md pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50, rotate: -5 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-card border-4 border-primary p-10 rounded-[3rem] shadow-[0_22px_70px_4px_rgba(0,0,0,0.56)] flex flex-col items-center text-center relative"
            >
              <div className="absolute -top-12 bg-primary text-primary-foreground p-5 rounded-full shadow-lg border-4 border-card">
                <Trophy className="h-10 w-10" />
              </div>
              <span className="text-7xl mb-6 mt-4">🏆</span>
              <h2 className="text-5xl font-black text-primary tracking-tighter mb-2">LEVEL UP!</h2>
              <p className="text-2xl font-bold text-foreground mb-4">وصلت للمستوى {newLevelNum}</p>
              <div className="bg-primary/10 px-6 py-2 rounded-2xl border-2 border-primary/20">
                <p className="text-sm font-bold text-primary">انت بقيت بطل أقوى دلوقتي! 🔥</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-xl">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-primary tracking-tight">LevelUp <span className="text-foreground/60 text-xs font-medium">v1.2</span></h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold italic">التدريس بأصوله .. وباللعب</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVoice}
            className={cn("h-9 w-9 rounded-xl transition-all", voiceEnabled ? "text-primary bg-primary/10" : "text-muted-foreground")}
            title={voiceEnabled ? "كتم الصوت" : "تشغيل الصوت"}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <Avatar
                className={cn(
                  "h-9 w-9 shrink-0 border-2",
                  msg.role === "assistant"
                    ? "border-primary/40 bg-primary/15"
                    : "border-primary/30 bg-primary/20"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="flex h-full w-full items-center justify-center text-primary">
                    <Bot className="h-5 w-5" aria-hidden />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary text-2xl">
                    👦
                  </div>
                )}
              </Avatar>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm",
                  msg.role === "assistant"
                    ? "bg-card border border-border text-foreground"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Attached"
                    className="mb-2 max-h-32 rounded-lg object-cover"
                  />
                )}
                <p className="text-sm whitespace-pre-wrap break-words" dir="auto">{msg.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <Avatar className="h-9 w-9 shrink-0 border-2 border-primary/40 bg-primary/15">
              <div className="flex h-full w-full items-center justify-center text-primary">
                <Bot className="h-5 w-5" aria-hidden />
              </div>
            </Avatar>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-muted-foreground">المدرس بيفكر...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border bg-card/95 p-3 pb-20 safe-area-pb md:pb-3">
        {previewUrl && (
          <div className="relative mb-2 inline-block">
            <img
              src={previewUrl}
              alt="Preview"
              className="h-16 w-16 rounded-lg object-cover border-2 border-primary/30"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload or take photo"
          />
          <Button
            type="button"
            size="icon"
            variant="default"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload image or camera"
          >
            <Camera className="h-5 w-5" aria-hidden />
          </Button>
          <div className="relative flex-1 rounded-xl border-2 border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <input
              type="text"
              placeholder="اكتب سؤالك هنا..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              className="w-full bg-transparent px-4 py-3 pr-20 text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
              disabled={loading}
              dir="auto"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  "h-8 w-8 transition-all relative overflow-visible",
                  isListening && "text-destructive animate-pulse bg-destructive/10 ring-2 ring-destructive/30 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                )}
                aria-label={isListening ? "Stop listening" : "Start voice input"}
                onClick={toggleMic}
                disabled={!isSupported || loading}
              >
                <Mic className={cn("h-4 w-4", isListening ? "text-destructive" : "text-muted-foreground")} aria-hidden />
                {isListening && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                  </span>
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={sendMessage}
                disabled={loading || (!input.trim() && !pendingFile)}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 🔋 Out of Energy Modal */}
      <OutOfEnergyModal
        isOpen={showOutOfEnergy}
        onClose={() => setShowOutOfEnergy(false)}
      />
    </div>
  );
}