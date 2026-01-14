"use client";

import { Recommendation } from "@/types/dashboard";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconSparkles,
  IconMicrophone,
  IconPlayerStop,
} from "@tabler/icons-react";

import RecommendationItem from "./RecommendationItem";
import { VoiceUtterance, UseVoiceInputReturn } from "@/hooks/useVoiceInput";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* =======================================================
   Constants
======================================================= */

const TRANSCRIPT_HEIGHT = "h-16";
const CONVERSATION_HEIGHT = "h-32";
const BOTTOM_STACK_PADDING = "pb-[220px]";

/* ===================== Live Transcript ===================== */

function LiveTranscript({
  isListening,
  partial,
  placeholder,
}: {
  isListening: boolean;
  partial: string;
  placeholder: string;
}) {
  return (
    <div
      className={cn(
        "border-t bg-background/95 backdrop-blur px-3 py-2",
        TRANSCRIPT_HEIGHT,
        !isListening && "hidden"
      )}
    >
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <div className="size-2 rounded-full bg-red-500 animate-pulse" />
        <span>Listening…</span>
      </div>

      <div className="mt-1 text-xs leading-relaxed truncate">
        {partial || placeholder}
        <span className="ml-1 inline-block w-1.5 animate-pulse bg-muted-foreground/60">
          &nbsp;
        </span>
      </div>
    </div>
  );
}

/* ===================== Conversation Panel ===================== */

function ConversationPanel({
  conversation,
}: {
  conversation: VoiceUtterance[];
}) {
  const sorted = useMemo(
    () => [...conversation].sort((a, b) => b.timestamp - a.timestamp),
    [conversation]
  );

  return (
    <div
      className={cn(
        "border-t bg-background/95 backdrop-blur px-3 py-2",
        CONVERSATION_HEIGHT
      )}
    >
      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Conversation
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto h-full pr-1">
        {sorted.length === 0 && (
          <div className="text-[10px] text-muted-foreground/60">
            No conversation yet
          </div>
        )}

        {sorted.map((u) => (
          <div
            key={u.id}
            className="rounded-md border bg-background/50 px-2 py-1 text-[11px]"
          >
            <div className="mb-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>{u.lang}</span>
              <span>·</span>
              <span>
                {new Date(u.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="leading-snug">{u.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== Voice Footer ===================== */

function VoiceFooterBar({
  isListening,
  onStart,
  onStop,
  onClear,
}: {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={false}
      animate={
        isListening
          ? { scale: 1.03, boxShadow: "0 0 0 4px rgba(239,68,68,0.15)" }
          : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
      }
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={isListening ? onStop : onStart}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs border transition",
            isListening
              ? "bg-red-500/10 border-red-500/30 text-red-600"
              : "hover:bg-muted"
          )}
        >
          {isListening ? (
            <>
              <IconPlayerStop className="size-4" />
              Stop
            </>
          ) : (
            <>
              <IconMicrophone className="size-4" />
              Voice
            </>
          )}
        </button>

        <button
          onClick={onClear}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
    </motion.div>
  );
}

/* ===================== Sidebar ===================== */

export default function RecommendationSidebar({
  recs,
  onAccept,
  voice,
  isGenerating = false,
}: {
  recs: Recommendation[];
  onAccept: (r: Recommendation) => void;
  voice: UseVoiceInputReturn;
  isGenerating?: boolean;
}) {
  const [language, setLanguage] = useState<"en-US" | "ko-KR" | "ja-JP">(
    "en-US"
  );

  const { isListening, partial, conversation, start, stop, clearConversation } =
    voice;

  const placeholder =
    language === "ko-KR"
      ? "말씀하세요…"
      : language === "ja-JP"
      ? "話してください…"
      : "Speak now…";

  return (
    <Sidebar side="right" className="border-l h-screen flex flex-col">
      {/* ================= Header ================= */}
      <SidebarHeader className="border-b p-3.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-3 px-2">
              <div className="flex items-center gap-2">
                <IconSparkles className="size-5 text-primary" />
                <div>
                  <div className="font-semibold">Recommendations</div>
                  <div className="text-xs text-muted-foreground">
                    AI-powered suggestions
                  </div>
                </div>
              </div>

              <select
                value={language}
                disabled={isListening}
                onChange={(e) => setLanguage(e.target.value as any)}
                className={cn(
                  "text-xs border rounded px-2 py-1 bg-background",
                  isListening && "opacity-50 pointer-events-none"
                )}
              >
                <option value="en-US">EN</option>
                <option value="ko-KR">KO</option>
                <option value="ja-JP">JA</option>
              </select>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ================= MAIN CONTENT ================= */}
      <SidebarContent className="flex-1 overflow-hidden">
        <ScrollArea className={cn("h-full p-4", BOTTOM_STACK_PADDING)}>
          <div className="flex flex-col gap-4">
            {isGenerating && !isListening && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <IconSparkles className="size-4 animate-pulse text-primary" />
                Analyzing discussion context…
              </div>
            )}

            <AnimatePresence>
              {recs.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <RecommendationItem recommendation={r} onAccept={onAccept} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </SidebarContent>

      {/* ================= FIXED BOTTOM STACK ================= */}
      <LiveTranscript
        isListening={isListening}
        partial={partial}
        placeholder={placeholder}
      />

      <ConversationPanel conversation={conversation} />

      <SidebarFooter className="border-t p-3 space-y-2">
        <VoiceFooterBar
          isListening={isListening}
          onStart={start}
          onStop={stop}
          onClear={clearConversation}
        />

        <div className="text-[10px] text-muted-foreground/60">
          {isListening
            ? "Listening to conversation… speak naturally"
            : "Suggestions are generated based on interaction focus."}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
