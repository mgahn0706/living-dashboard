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
  IconMessageDots,
  IconChevronDown,
} from "@tabler/icons-react";

import { UseVoiceInputReturn } from "@/hooks/useVoiceInput";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconArrowsDownUp,
  IconResize,
  IconPlus,
  IconPencil,
  IconFilter,
  IconTrash,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  buildRecentRequestMessages,
  summarizeRecentRequest,
  type RecentRequestMessage,
} from "@/lib/recommendation/requestSummary";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* =======================================================
   Types
======================================================= */

type UnifiedMessage = RecentRequestMessage;

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
  if (!isListening) return null;

  return (
    <div className="border-t bg-background/95 backdrop-blur px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Listening…</span>
      </div>

      <div className="mt-1 text-xs truncate">
        {partial || placeholder}
        <span className="ml-1 inline-block w-1.5 animate-pulse bg-muted-foreground/60">
          &nbsp;
        </span>
      </div>
    </div>
  );
}

/* ===================== Conversation Timeline ===================== */

function ConversationTimeline({ messages }: { messages: UnifiedMessage[] }) {
  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  return (
    <div className="bg-background/95 backdrop-blur px-3 py-2 max-h-40 overflow-y-auto">
      <div className="flex flex-col gap-1">
        {sorted.length === 0 && (
          <div className="text-[10px] text-muted-foreground/60">
            No conversation yet
          </div>
        )}

        {sorted.map((m) => {
          const isVoice = m.source === "voice";

          return (
            <div
              key={m.id}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] border-l-4",
                isVoice
                  ? "bg-emerald-500/5 border-emerald-500/20 border-l-emerald-500"
                  : "bg-violet-500/5 border-violet-500/20 border-l-violet-500"
              )}
            >
              <div className="mb-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                {isVoice ? (
                  <IconMicrophone className="size-3 text-emerald-600" />
                ) : (
                  <IconMessageDots className="size-3 text-violet-600" />
                )}

                {m.lang && (
                  <>
                    <span>·</span>
                    <span>{m.lang}</span>
                  </>
                )}

                <span>·</span>
                <span>
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="leading-snug">{m.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentRequestSummaryCard({ summary }: { summary: string }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
        <IconSparkles className="size-3" />
        <span>Recent request summary</span>
      </div>
      <div className="mt-1 text-[11px] leading-snug text-foreground/90">
        {summary}
      </div>
    </div>
  );
}

/* ===================== Chat Input ===================== */

function ChatInputBar({
  isListening,
  onStart,
  onStop,
  onSend,
}: {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={isListening ? onStop : onStart}
        className={cn(
          "rounded-md p-2 border transition",
          isListening
            ? "bg-red-500/10 border-red-500/30 text-red-600"
            : "hover:bg-muted"
        )}
      >
        {isListening ? (
          <IconPlayerStop className="size-4" />
        ) : (
          <IconMicrophone className="size-4" />
        )}
      </button>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Type a message…"
        className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
      />

      <button
        onClick={submit}
        className="text-xs px-2 py-1 rounded border hover:bg-muted"
      >
        Send
      </button>
    </div>
  );
}

/* ===================== Sidebar ===================== */

export default function RecommendationSidebar({
  history = [],
  voice,
  language,
  isGenerating = false,
  textChats = [],
  onChangeLanguage,
  onUndoLatest,
  onSendTextChat,
}: {
  history?: Recommendation[];
  voice: UseVoiceInputReturn;
  language: "en-US" | "ko-KR" | "ja-JP";
  isGenerating?: boolean;
  textChats?: string[];
  onUndoLatest?: () => void;
  onSendTextChat?: (text: string) => void;
  onChangeLanguage: (lang: "en-US" | "ko-KR" | "ja-JP") => void;
}) {
  const { isListening, partial, conversation, start, stop } = voice;

  const placeholder =
    language === "ko-KR"
      ? "말씀하세요…"
      : language === "ja-JP"
      ? "話してください…"
      : "Speak now…";

  const unifiedMessages: UnifiedMessage[] = useMemo(() => {
    return buildRecentRequestMessages({
      conversation,
      textChats,
    });
  }, [conversation, textChats]);
  const recentRequestSummary = useMemo(
    () => summarizeRecentRequest(unifiedMessages),
    [unifiedMessages]
  );

  return (
    <>
      {" "}
      {/* Header */}
      <SidebarHeader className="border-b p-3.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-3 px-2">
              <div className="flex items-center gap-2">
                <IconSparkles className="size-5 text-primary" />
                <div>
                  <div className="font-semibold">AI History</div>
                </div>
              </div>

              <select
                value={language}
                disabled={isListening}
                onChange={(e) => onChangeLanguage(e.target.value as any)}
                className="text-xs border rounded px-2 py-1 bg-background"
              >
                <option value="en-US">EN</option>
                <option value="ko-KR">KO</option>
                <option value="ja-JP">JA</option>
              </select>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      {/* Recommendations Scroll */}
      <SidebarContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="flex flex-col gap-4 pr-1">
            {isGenerating && !isListening && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <IconSparkles className="size-4 animate-pulse text-primary" />
                Analyzing discussion context…
              </div>
            )}

            {history.length === 0 && !isGenerating && (
              <div className="text-xs text-muted-foreground">
                No applied recommendations yet.
              </div>
            )}

            {history.length > 0 && onUndoLatest && (
              <button
                onClick={onUndoLatest}
                className="w-full rounded-md border bg-background/70 px-3 py-2 text-xs font-semibold text-primary hover:bg-muted"
              >
                Undo last change
              </button>
            )}

            <RecentRequestSummaryCard summary={recentRequestSummary} />

            <AnimatePresence>
              {history.map((r) => {
                const icon =
                  r.type === "REORDER" ? (
                    <IconArrowsDownUp className="size-4" />
                  ) : r.type === "RESIZE" ? (
                    <IconResize className="size-4" />
                  ) : r.type === "NEW_CONTENT" ? (
                    <IconPlus className="size-4" />
                  ) : r.type === "MODIFY_FILTER" ? (
                    <IconFilter className="size-4" />
                  ) : r.type === "MODIFY_CONTENT" ? (
                    <IconPencil className="size-4" />
                  ) : (
                    <IconTrash className="size-4" />
                  );

                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="w-full min-w-0 flex items-start gap-2 rounded-md border bg-background/60 px-2.5 py-2 text-xs">
                      <div className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            AI recommendation
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                            {r.type.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 break-words font-medium leading-snug">
                            {r.title}
                          </div>
                        </div>
                        <div className="mt-1 break-words text-[11px] text-muted-foreground">
                          {r.reason}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </SidebarContent>
      {/* Bottom Stack */}
      <div className="sticky bottom-0 z-10">
        <LiveTranscript
          isListening={isListening}
          partial={partial}
          placeholder={placeholder}
        />

        <Collapsible defaultOpen>
          <div className="border-t bg-background/95 backdrop-blur px-3 py-2">
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Chat log and request context</span>
              <IconChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <ConversationTimeline messages={unifiedMessages} />
          </CollapsibleContent>
        </Collapsible>

        <SidebarFooter className="border-t p-3 space-y-2 bg-background/95 backdrop-blur">
          <ChatInputBar
            isListening={isListening}
            onStart={start}
            onStop={stop}
            onSend={(text) => onSendTextChat?.(text)}
          />

          <div className="text-[10px] text-muted-foreground/60">
            Voice and text both influence recommendations.
          </div>
        </SidebarFooter>
      </div>
    </>
  );
}
