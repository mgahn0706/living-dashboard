"use client";

import { Recommendation } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import {
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
  IconCheck,
  IconX,
  IconArrowsDownUp,
  IconResize,
  IconPlus,
  IconPencil,
  IconFilter,
  IconTrash,
  IconBolt,
  IconArrowUpRight,
  IconSend,
  IconChevronDown,
} from "@tabler/icons-react";

import { UseVoiceInputReturn } from "@/hooks/useVoiceInput";
import type { LlmReply } from "@/hooks/useRecommendation";
import type { ChatEntry } from "@/hooks/useChat";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  buildRecentRequestMessages,
  type RecentRequestMessage,
} from "@/lib/recommendation/requestSummary";

/* =======================================================
   Helpers
======================================================= */

/** Per-recommendation color palette (indexed by position). */
export const REC_PALETTE = [
  "#EC4899", // pink
  "#6366F1", // indigo
  "#F59E0B", // amber
  "#10B981", // emerald
  "#8B5CF6", // violet
  "#EF4444", // red
];

export function getRecColor(index: number): string {
  return REC_PALETTE[index % REC_PALETTE.length];
}

/** Derive a short action-oriented label from the recommendation's content. */
export function getActionLabel(r: Recommendation): string {
  const filler = new Set([
    "the",
    "a",
    "an",
    "by",
    "for",
    "to",
    "of",
    "in",
    "on",
    "with",
    "and",
    "or",
    "is",
    "are",
    "was",
    "this",
    "that",
    "it",
  ]);
  const actionVerbs = new Set([
    "filter",
    "focus",
    "show",
    "hide",
    "add",
    "remove",
    "update",
    "change",
    "drill",
    "group",
    "sort",
    "compare",
    "highlight",
    "reduce",
    "expand",
    "replace",
    "switch",
    "convert",
    "split",
  ]);

  const words = r.title
    .split(/\s+/)
    .filter((w) => !filler.has(w.toLowerCase()) && w.length > 1);
  const firstWord = r.title.split(/\s+/)[0]?.toLowerCase() || "";

  // If the title already starts with an action verb, use its first words
  if (actionVerbs.has(firstWord)) {
    return words.slice(0, 3).join(" ").toUpperCase();
  }

  // Otherwise, prepend a verb derived from the recommendation type
  const verbMap: Record<string, string> = {
    MODIFY_FILTER: "FILTER",
    MODIFY_CONTENT: "UPDATE",
    NEW_CONTENT: "ADD",
    REMOVE_CONTENT: "REMOVE",
    REORDER: "REORDER",
    RESIZE: "RESIZE",
    HIGHLIGHT: "HIGHLIGHT",
  };
  const prefix = verbMap[r.type] || "UPDATE";
  const nouns = words
    .filter((w) => !actionVerbs.has(w.toLowerCase()))
    .slice(0, 2)
    .join(" ")
    .toUpperCase();

  return nouns ? `${prefix} ${nouns}` : prefix;
}

function recIcon(type: Recommendation["type"]) {
  switch (type) {
    case "REORDER":
      return <IconArrowsDownUp className="size-4" />;
    case "RESIZE":
      return <IconResize className="size-4" />;
    case "NEW_CONTENT":
      return <IconPlus className="size-4" />;
    case "MODIFY_FILTER":
      return <IconFilter className="size-4" />;
    case "MODIFY_CONTENT":
      return <IconPencil className="size-4" />;
    case "HIGHLIGHT":
      return <IconBolt className="size-4" />;
    default:
      return <IconTrash className="size-4" />;
  }
}

/** Derive a confidence score from position (first = highest). */
function getConfidence(index: number, total: number): number {
  const base = 95;
  const step = Math.min(13, 30 / Math.max(total, 1));
  return Math.max(55, Math.round(base - index * step));
}

/** Resolve a recommendation's target view ID. */
function getRecTargetViewId(r: Recommendation): string | undefined {
  return r.targetViewId ?? (r.payload as any)?.id;
}

/** Scroll to a chart card and flash a highlight pulse in the given color. */
function scrollToChart(viewId: string, color: string) {
  const el = document.querySelector(
    `[data-view-id="${viewId}"]`
  ) as HTMLElement | null;
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  // Brief highlight pulse: flash on, then fade out over 1.2s
  const origBoxShadow = el.style.boxShadow;
  const origTransition = el.style.transition;

  el.style.transition = "box-shadow 0.2s ease-in";
  el.style.boxShadow = `0 0 0 3px ${color}55, 0 0 30px ${color}33`;

  setTimeout(() => {
    el.style.transition = "box-shadow 1.3s ease-out";
    el.style.boxShadow = origBoxShadow;

    // Clean up inline transition after animation completes
    setTimeout(() => {
      el.style.transition = origTransition;
    }, 1400);
  }, 300);
}

/* ===================== Confidence Bar ===================== */

function ConfidenceBar({
  confidence,
  index,
  color,
}: {
  confidence: number;
  index: number;
  color: string;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(confidence), 100 + index * 80);
    return () => clearTimeout(timer);
  }, [confidence, index]);

  return (
    <div className="h-[3px] w-full rounded-full bg-muted/60 overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

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

/* ===================== Unified Feed Entry Types ===================== */

type UnifiedFeedEntry =
  | { kind: "user"; msg: RecentRequestMessage }
  | { kind: "assistant"; reply: LlmReply }
  | {
      kind: "recommendations";
      recs: Recommendation[];
      justApplied: Recommendation[];
    };

/* ===================== User Message Bubble ===================== */

function UserMessageBubble({ msg }: { msg: RecentRequestMessage }) {
  const isVoice = msg.source === "voice";
  return (
    <div
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
        {msg.lang && (
          <>
            <span>·</span>
            <span>{msg.lang}</span>
          </>
        )}
        <span>·</span>
        <span>
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="leading-snug">{msg.text}</div>
    </div>
  );
}

/* ===================== Assistant Reply Bubble ===================== */

function AssistantReplyBubble({ reply }: { reply: LlmReply }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-[11px] leading-snug text-foreground shadow-sm">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
            <IconSparkles className="size-3" />
            <span>Assistant</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {new Date(reply.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="mt-1 whitespace-pre-wrap">{reply.text}</div>
      </div>
    </div>
  );
}

/* ===================== Chat Conversation (System B) ===================== */

function ChatConversation({
  messages,
  streamingText,
  isLoading,
}: {
  messages: ChatEntry[];
  streamingText?: string;
  isLoading?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingText]);

  return (
    <div className="h-full bg-background/95 backdrop-blur px-3 py-2">
      <div className="flex flex-col gap-1.5">
        {messages.length === 0 && !isLoading && (
          <div className="text-[10px] text-muted-foreground/60 py-4 text-center">
            Ask a question about your data...
          </div>
        )}

        {messages.map((entry) => {
          if (entry.role === "user") {
            const isVoice = entry.source === "voice";
            return (
              <div
                key={entry.id}
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
                  <span>
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="leading-snug">{entry.content}</div>
              </div>
            );
          }

          return (
            <div key={entry.id} className="flex justify-end">
              <div className="max-w-[88%] rounded-2xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-[11px] leading-snug text-foreground shadow-sm">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
                    <IconSparkles className="size-3" />
                    <span>Assistant</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-1 whitespace-pre-wrap">{entry.content}</div>
              </div>
            </div>
          );
        })}

        {isLoading && streamingText && (
          <div className="flex justify-end">
            <div className="max-w-[88%] rounded-2xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-[11px] leading-snug text-foreground shadow-sm">
              <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
                <IconSparkles className="size-3 animate-pulse" />
                <span>Assistant</span>
              </div>
              <div className="mt-1 whitespace-pre-wrap">
                {streamingText}
                <span className="inline-block w-1.5 h-3.5 bg-sky-500/60 animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          </div>
        )}

        {isLoading && !streamingText && (
          <div className="flex justify-end">
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-3 py-2">
              <div className="flex items-center gap-2 text-[10px] text-sky-700 dark:text-sky-400">
                <IconSparkles className="size-3 animate-pulse" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/* ===================== Chat Input ===================== */

function ChatInputBar({
  isListening,
  disabled = false,
  onStart,
  onStop,
  onSend,
}: {
  isListening: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const hasText = text.trim().length > 0;

  const submit = () => {
    if (disabled || !hasText) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={isListening ? onStop : onStart}
        disabled={disabled}
        className={cn(
          "rounded-md p-2 border transition",
          disabled
            ? "cursor-not-allowed border-muted bg-muted/50 text-muted-foreground/50"
            : "",
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
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (isComposing || e.nativeEvent.isComposing || e.keyCode === 229) {
            return;
          }
          submit();
        }}
        placeholder={disabled ? "AI suggestions disabled in System B" : "Type a message…"}
        disabled={disabled}
        className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
      />

      <button
        type="button"
        onClick={submit}
        disabled={disabled || !hasText}
        className={cn(
          "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 flex items-center gap-1",
          !disabled && hasText
            ? "bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-sm hover:shadow-md cursor-pointer"
            : "bg-muted text-muted-foreground/40 cursor-not-allowed border border-transparent"
        )}
      >
        <IconSend className="size-3" />
        Send
      </button>
    </div>
  );
}

function AppliedHistoryItem({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="w-full min-w-0 flex items-start gap-2 rounded-md border bg-background/60 px-2.5 py-2 text-xs">
      <div className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {recIcon(recommendation.type)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Applied
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {recommendation.type.replace("_", " ")}
          </span>
        </div>
        <div className="min-w-0 break-words font-medium leading-snug">
          {recommendation.title}
        </div>
        <div className="mt-1 break-words text-[11px] text-muted-foreground">
          {recommendation.reason}
        </div>
      </div>
    </div>
  );
}

/* ===================== Sidebar ===================== */

export default function RecommendationSidebar({
  history = [],
  activeRecommendations = [],
  llmReplies = [],
  recommendationsEnabled = true,
  voice,
  language,
  isGenerating = false,
  streamingText = "",
  textChats = [],
  viewTitles = {},
  chatMessages = [],
  onChangeLanguage,
  onUndoLatest,
  onSendTextChat,
  onAcceptRecommendation,
  onDeclineRecommendation,
  onAcceptAllRecommendations,
}: {
  history?: Recommendation[];
  activeRecommendations?: Recommendation[];
  llmReplies?: LlmReply[];
  recommendationsEnabled?: boolean;
  voice: UseVoiceInputReturn;
  language: "en-US" | "ko-KR" | "ja-JP";
  isGenerating?: boolean;
  streamingText?: string;
  textChats?: string[];
  viewTitles?: Record<string, string>;
  chatMessages?: ChatEntry[];
  onUndoLatest?: () => void;
  onSendTextChat?: (text: string) => void;
  onAcceptRecommendation?: (rec: Recommendation) => void;
  onDeclineRecommendation?: (rec: Recommendation) => void;
  onAcceptAllRecommendations?: () => void;
  onChangeLanguage: (lang: "en-US" | "ko-KR" | "ja-JP") => void;
}) {
  const { isListening, partial, conversation, start, stop } = voice;
  const [justAppliedIds, setJustAppliedIds] = useState<Set<string>>(new Set());
  const [showOlderHistory, setShowOlderHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Stable color assignment: remember each rec's original palette index so
  // colors don't shift when earlier recommendations are applied/removed.
  const colorMapRef = useRef<Map<string, number>>(new Map());
  useMemo(() => {
    activeRecommendations.forEach((r, idx) => {
      if (!colorMapRef.current.has(r.id)) {
        colorMapRef.current.set(r.id, idx);
      }
    });
  }, [activeRecommendations]);

  const placeholder =
    language === "ko-KR"
      ? "말씀하세요…"
      : language === "ja-JP"
      ? "話してください…"
      : "Speak now…";

  // Cache text-message timestamps so they don't shift on every recalculation.
  // buildRecentRequestMessages uses Date.now() as a synthetic base, which would
  // regenerate timestamps and break chronological ordering against llmReplies.
  const textTsCache = useRef<Map<string, number>>(new Map());

  const unifiedMessages = useMemo(() => {
    const msgs = buildRecentRequestMessages({ conversation, textChats });
    return msgs.map((m) => {
      if (m.source !== "text") return m; // voice timestamps are already stable
      const cached = textTsCache.current.get(m.id);
      if (cached != null) return { ...m, timestamp: cached };
      textTsCache.current.set(m.id, m.timestamp);
      return m;
    });
  }, [conversation, textChats]);

  const handleApply = useCallback(
    (rec: Recommendation) => {
      setJustAppliedIds((prev) => new Set(prev).add(rec.id));
      onAcceptRecommendation?.(rec);
      // Auto-clear the success state after 2.5 seconds
      setTimeout(() => {
        setJustAppliedIds((prev) => {
          const next = new Set(prev);
          next.delete(rec.id);
          return next;
        });
      }, 2500);
    },
    [onAcceptRecommendation]
  );

  const handleApplyAll = useCallback(() => {
    activeRecommendations.forEach((rec) => {
      setJustAppliedIds((prev) => new Set(prev).add(rec.id));
    });
    onAcceptAllRecommendations?.();
    // Auto-clear all success states
    setTimeout(() => {
      setJustAppliedIds(new Set());
    }, 2500);
  }, [activeRecommendations, onAcceptAllRecommendations]);

  const appliedCount = history.length;
  const pendingCount = activeRecommendations.length;

  // Combine just-applied recs (for success animation) with active recs
  const justAppliedRecs = useMemo(
    () => history.filter((r) => justAppliedIds.has(r.id)),
    [history, justAppliedIds]
  );
  const appliedHistory = useMemo(
    () => history.filter((r) => !justAppliedIds.has(r.id)),
    [history, justAppliedIds]
  );

  // Build the unified chronological feed for System A
  const unifiedFeed = useMemo<UnifiedFeedEntry[]>(() => {
    const entries: UnifiedFeedEntry[] = [
      ...unifiedMessages.map((msg) => ({ kind: "user" as const, msg })),
      ...llmReplies.map((reply) => ({
        kind: "assistant" as const,
        reply,
      })),
    ];

    // Sort by timestamp
    const ts = (e: UnifiedFeedEntry) =>
      e.kind === "user"
        ? e.msg.timestamp
        : e.kind === "assistant"
        ? e.reply.timestamp
        : 0;
    entries.sort((a, b) => ts(a) - ts(b));

    // Insert recommendations after the latest assistant reply
    const hasRecContent =
      activeRecommendations.length > 0 || justAppliedRecs.length > 0;
    if (hasRecContent) {
      let lastAssistantIdx = -1;
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].kind === "assistant") {
          lastAssistantIdx = i;
          break;
        }
      }
      const insertAt =
        lastAssistantIdx >= 0 ? lastAssistantIdx + 1 : entries.length;
      entries.splice(insertAt, 0, {
        kind: "recommendations",
        recs: activeRecommendations,
        justApplied: justAppliedRecs,
      });
    }

    return entries;
  }, [unifiedMessages, llmReplies, activeRecommendations, justAppliedRecs]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [unifiedFeed.length, isGenerating]);

  return (
    <>
      {/* Header */}
      <SidebarHeader className="border-b p-3.5 pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-3 px-2">
              <div className="flex items-center gap-2">
                <IconSparkles className="size-5 text-primary" />
                <div>
                  <div className="text-sm font-semibold">
                    {recommendationsEnabled ? "AI Suggestions" : "AI Assistant"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {recommendationsEnabled
                      ? `${appliedCount} applied · ${pendingCount} pending`
                      : "Chat available"}
                  </div>
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

        {/* Section label (no tabs) */}
        <div className="flex mt-2">
          <div className="w-full py-2 text-[11px] font-semibold uppercase tracking-wide text-primary border-b-2 border-primary text-center">
            {recommendationsEnabled ? "Conversation" : "Data Chat"}
          </div>
        </div>
      </SidebarHeader>

      {/* Main scroll area */}
      <SidebarContent className="flex-1 overflow-hidden">
        {!recommendationsEnabled ? (
          /* ===== System B: Chat Conversation (unchanged) ===== */
          <ScrollArea className="h-full">
            <ChatConversation
              messages={chatMessages}
              streamingText={streamingText}
              isLoading={isGenerating}
            />
          </ScrollArea>
        ) : (
          /* ===== System A: Unified Feed ===== */
          <ScrollArea className="h-full p-4">
            <div className="flex flex-col gap-2 pr-1">

              {/* ===== Applied History (collapsible, at top) ===== */}
              {appliedHistory.length > 0 && (
                <div className="flex flex-col gap-2 mb-1">
                  {onUndoLatest && (
                    <button
                      onClick={onUndoLatest}
                      className="w-full rounded-md border bg-background/70 px-3 py-2 text-xs font-semibold text-primary hover:bg-muted"
                    >
                      Undo last change
                    </button>
                  )}

                  <Collapsible
                    open={showOlderHistory}
                    onOpenChange={setShowOlderHistory}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex w-full items-center justify-between rounded-md border bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">
                        <span>
                          Previous suggestions ({appliedHistory.length})
                        </span>
                        <IconChevronDown
                          className={cn(
                            "size-4 transition-transform",
                            showOlderHistory && "rotate-180"
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-2 space-y-2">
                      <AnimatePresence initial={false}>
                        {appliedHistory.map((r, idx) => (
                          <motion.div
                            key={`${r.id}-${idx}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <AppliedHistoryItem recommendation={r} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {/* ===== Chronological Unified Feed ===== */}
              {unifiedFeed.map((entry, i) => {
                if (entry.kind === "user") {
                  return (
                    <UserMessageBubble key={entry.msg.id} msg={entry.msg} />
                  );
                }

                if (entry.kind === "assistant") {
                  return (
                    <AssistantReplyBubble
                      key={`ai-${i}`}
                      reply={entry.reply}
                    />
                  );
                }

                if (entry.kind === "recommendations") {
                  return (
                    <div key="rec-group" className="flex flex-col gap-2">
                      {/* Apply All banner */}
                      {entry.recs.length > 1 && (
                        <button
                          onClick={handleApplyAll}
                          className="w-full flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs transition hover:bg-primary/10"
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-primary">
                            <IconBolt className="size-3.5" />
                            Apply all {entry.recs.length} recommendations
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            1-click
                          </span>
                        </button>
                      )}

                      {/* Just-Applied success cards */}
                      <AnimatePresence>
                        {entry.justApplied.map((r, idx) => (
                          <motion.div
                            key={`applied-${r.id}-${idx}`}
                            initial={{ opacity: 1, scale: 1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{
                              opacity: 0,
                              height: 0,
                              marginBottom: 0,
                            }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="w-full min-w-0 flex items-center gap-2 rounded-lg border-2 border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/30 px-3 py-2.5 text-xs">
                              <div className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                                <IconCheck className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-emerald-700 dark:text-emerald-300">
                                  Applied to dashboard
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {r.title}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {/* Active recommendation cards */}
                      {entry.recs.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <AnimatePresence>
                            {entry.recs.map((r, idx) => {
                              const confidence = getConfidence(
                                idx,
                                entry.recs.length
                              );
                              const targetId = getRecTargetViewId(r);
                              const targetTitle = targetId
                                ? viewTitles[targetId]
                                : undefined;
                              const color = getRecColor(
                                colorMapRef.current.get(r.id) ?? idx
                              );

                              return (
                                <motion.div
                                  key={r.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{
                                    opacity: 0,
                                    scale: 0.95,
                                    height: 0,
                                  }}
                                  transition={{ duration: 0.25 }}
                                >
                                  <div
                                    className="w-full min-w-0 rounded-lg border-2 text-xs overflow-hidden"
                                    style={{
                                      borderColor: `${color}40`,
                                      backgroundColor: `${color}08`,
                                    }}
                                  >
                                    {/* Card header: rank + type + confidence */}
                                    <div
                                      className="flex items-center gap-2 px-2.5 py-2 border-b"
                                      style={{
                                        borderBottomColor: `${color}20`,
                                      }}
                                    >
                                      <div
                                        className="inline-flex size-6 items-center justify-center rounded-md font-bold text-[11px] shrink-0"
                                        style={{
                                          backgroundColor: `${color}20`,
                                          color,
                                        }}
                                      >
                                        {idx + 1}
                                      </div>
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                        style={{
                                          backgroundColor: `${color}15`,
                                          color,
                                        }}
                                      >
                                        {recIcon(r.type)}
                                        {getActionLabel(r)}
                                      </span>
                                      <span className="ml-auto text-[10px] font-semibold text-muted-foreground">
                                        {confidence}% match
                                      </span>
                                    </div>

                                    {/* Card body */}
                                    <div className="px-2.5 py-2">
                                      <div className="font-medium leading-snug break-words">
                                        {r.title}
                                      </div>
                                      <div className="mt-1 break-words text-[11px] text-muted-foreground">
                                        {r.reason}
                                      </div>

                                      {/* Target chart link */}
                                      {targetTitle && targetId && (
                                        <button
                                          onClick={() =>
                                            scrollToChart(targetId, color)
                                          }
                                          className="mt-2 inline-flex items-center gap-1 rounded-md border bg-background/60 px-2 py-1 text-[10px] text-muted-foreground cursor-pointer transition-colors hover:bg-muted group"
                                        >
                                          <IconArrowUpRight
                                            className="size-3"
                                            style={{ color }}
                                          />
                                          <span className="truncate max-w-[160px] group-hover:underline">
                                            {targetTitle}
                                          </span>
                                        </button>
                                      )}

                                      {/* Confidence bar */}
                                      <div className="mt-2">
                                        <ConfidenceBar
                                          confidence={confidence}
                                          index={idx}
                                          color={color}
                                        />
                                      </div>

                                      {/* Actions */}
                                      <div className="mt-2.5 flex items-center gap-1">
                                        <button
                                          className="inline-flex items-center gap-1 rounded-md h-6 px-2 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                                          style={{ backgroundColor: color }}
                                          onClick={() => handleApply(r)}
                                        >
                                          <IconCheck className="size-3" />
                                          Apply
                                        </button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6"
                                          onClick={() =>
                                            onDeclineRecommendation?.(r)
                                          }
                                          aria-label="Decline"
                                        >
                                          <IconX className="size-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}

              {/* ===== Empty state ===== */}
              {unifiedFeed.length === 0 &&
                appliedHistory.length === 0 &&
                !isGenerating && (
                  <div className="text-xs text-muted-foreground py-4 text-center">
                    No conversation yet. Use voice or text to interact with your
                    dashboard.
                  </div>
                )}

              {/* ===== Streaming / Loading indicator ===== */}
              {isGenerating && !isListening && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <IconSparkles className="size-4 animate-pulse" />
                    {streamingText
                      ? "Generating suggestions…"
                      : "Analyzing discussion context…"}
                  </div>

                  {/* Streaming text preview */}
                  {streamingText ? (
                    <div className="text-[11px] text-muted-foreground font-mono leading-relaxed max-h-24 overflow-hidden relative">
                      <div className="whitespace-pre-wrap break-all">
                        {streamingText.slice(-200)}
                      </div>
                      <span className="inline-block w-1.5 h-3.5 bg-primary/60 animate-pulse ml-0.5 align-middle" />
                      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
                    </div>
                  ) : (
                    /* Skeleton placeholder cards */
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="rounded-md border bg-background/60 p-2.5 space-y-2 animate-pulse"
                          style={{ animationDelay: `${i * 150}ms` }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-md bg-muted" />
                            <div className="h-3 w-20 rounded bg-muted" />
                            <div className="ml-auto h-3 w-12 rounded bg-muted" />
                          </div>
                          <div className="h-3 w-full rounded bg-muted" />
                          <div className="h-3 w-3/4 rounded bg-muted" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}
      </SidebarContent>

      {/* Bottom Stack */}
      <div className="sticky bottom-0 z-10">
        <LiveTranscript
          isListening={isListening}
          partial={partial}
          placeholder={placeholder}
        />

        <SidebarFooter className="border-t p-3 space-y-2 bg-background/95 backdrop-blur">
          <ChatInputBar
            isListening={isListening}
            onStart={start}
            onStop={stop}
            onSend={(text) => onSendTextChat?.(text)}
          />

          <div className="text-[10px] text-muted-foreground/60">
            {recommendationsEnabled
              ? "Voice and text both influence recommendations."
              : "System B uses the LLM as a chat assistant only."}
          </div>
        </SidebarFooter>
      </div>
    </>
  );
}
