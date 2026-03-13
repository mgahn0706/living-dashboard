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
} from "@tabler/icons-react";

import { UseVoiceInputReturn } from "@/hooks/useVoiceInput";
import type { LlmReply } from "@/hooks/useRecommendation";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
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
    "the", "a", "an", "by", "for", "to", "of", "in", "on", "with",
    "and", "or", "is", "are", "was", "this", "that", "it",
  ]);
  const actionVerbs = new Set([
    "filter", "focus", "show", "hide", "add", "remove", "update",
    "change", "drill", "group", "sort", "compare", "highlight",
    "reduce", "expand", "replace", "switch", "convert", "split",
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

/* ===================== Unified Chat Log ===================== */

type ChatEntry =
  | { kind: "user"; msg: RecentRequestMessage }
  | { kind: "assistant"; reply: LlmReply };

function ChatLog({
  userMessages,
  assistantReplies,
  fullHeight = false,
}: {
  userMessages: RecentRequestMessage[];
  assistantReplies: LlmReply[];
  fullHeight?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<ChatEntry[]>(() => {
    const all: ChatEntry[] = [
      ...userMessages.map((msg) => ({ kind: "user" as const, msg })),
      ...assistantReplies.map((reply) => ({
        kind: "assistant" as const,
        reply,
      })),
    ];
    return all.sort((a, b) => {
      const tA = a.kind === "user" ? a.msg.timestamp : a.reply.timestamp;
      const tB = b.kind === "user" ? b.msg.timestamp : b.reply.timestamp;
      return tA - tB;
    });
  }, [userMessages, assistantReplies]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div
      className={cn(
        "bg-background/95 backdrop-blur px-3 py-2 overflow-y-auto",
        fullHeight ? "h-full" : "max-h-52"
      )}
    >
      <div className="flex flex-col gap-1.5">
        {entries.length === 0 && (
          <div className="text-[10px] text-muted-foreground/60">
            No conversation yet
          </div>
        )}

        {entries.map((entry, i) => {
          if (entry.kind === "user") {
            const m = entry.msg;
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
          }

          // assistant
          const r = entry.reply;
          return (
            <div key={`ai-${i}`} className="flex justify-end">
              <div className="max-w-[88%] rounded-2xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-[11px] leading-snug text-foreground shadow-sm">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                    <IconSparkles className="size-3" />
                    <span>Assistant</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-1 whitespace-pre-wrap">{r.text}</div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
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
  const hasText = text.trim().length > 0;

  const submit = () => {
    if (!hasText) return;
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
        disabled={!hasText}
        className={cn(
          "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 flex items-center gap-1",
          hasText
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

/* ===================== Sidebar ===================== */

export default function RecommendationSidebar({
  history = [],
  activeRecommendations = [],
  llmReplies = [],
  voice,
  language,
  isGenerating = false,
  streamingText = "",
  textChats = [],
  viewTitles = {},
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
  voice: UseVoiceInputReturn;
  language: "en-US" | "ko-KR" | "ja-JP";
  isGenerating?: boolean;
  streamingText?: string;
  textChats?: string[];
  viewTitles?: Record<string, string>;
  onUndoLatest?: () => void;
  onSendTextChat?: (text: string) => void;
  onAcceptRecommendation?: (rec: Recommendation) => void;
  onDeclineRecommendation?: (rec: Recommendation) => void;
  onAcceptAllRecommendations?: () => void;
  onChangeLanguage: (lang: "en-US" | "ko-KR" | "ja-JP") => void;
}) {
  const { isListening, partial, conversation, start, stop } = voice;
  const [activeTab, setActiveTab] = useState<"suggestions" | "chat">(
    "suggestions"
  );
  const [justAppliedIds, setJustAppliedIds] = useState<Set<string>>(new Set());

  const placeholder =
    language === "ko-KR"
      ? "말씀하세요…"
      : language === "ja-JP"
        ? "話してください…"
        : "Speak now…";

  const unifiedMessages = useMemo(() => {
    return buildRecentRequestMessages({
      conversation,
      textChats,
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
                  <div className="text-sm font-semibold">AI Recommendations</div>
                  <div className="text-[10px] text-muted-foreground">
                    {appliedCount} applied · {pendingCount} pending
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

        {/* Tab navigation */}
        <div className="flex mt-2">
          <button
            onClick={() => setActiveTab("suggestions")}
            className={cn(
              "flex-1 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2",
              activeTab === "suggestions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Suggestions ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex-1 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2",
              activeTab === "chat"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Chat Log
          </button>
        </div>
      </SidebarHeader>

      {/* Main scroll area */}
      <SidebarContent className="flex-1 overflow-hidden">
        {activeTab === "suggestions" ? (
          <ScrollArea className="h-full p-4">
            <div className="flex flex-col gap-3 pr-1">
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

              {/* ===== Apply All Banner ===== */}
              {activeRecommendations.length > 1 && (
                <button
                  onClick={handleApplyAll}
                  className="w-full flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs transition hover:bg-primary/10"
                >
                  <span className="flex items-center gap-1.5 font-semibold text-primary">
                    <IconBolt className="size-3.5" />
                    Apply all {activeRecommendations.length} recommendations
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    1-click
                  </span>
                </button>
              )}

              {/* ===== Just-Applied Success Cards ===== */}
              <AnimatePresence>
                {justAppliedRecs.map((r) => (
                  <motion.div
                    key={`applied-${r.id}`}
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
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

              {/* ===== Active (Pending) Recommendations ===== */}
              {activeRecommendations.length > 0 && (
                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {activeRecommendations.map((r, idx) => {
                      const confidence = getConfidence(
                        idx,
                        activeRecommendations.length
                      );
                      const targetId = getRecTargetViewId(r);
                      const targetTitle = targetId
                        ? viewTitles[targetId]
                        : undefined;
                      const color = getRecColor(idx);

                      return (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, height: 0 }}
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
                              style={{ borderBottomColor: `${color}20` }}
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
                                  onClick={() => onDeclineRecommendation?.(r)}
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

              {/* ===== Applied History ===== */}
              {history.length > 0 && (
                <div className="flex flex-col gap-2">
                  {activeRecommendations.length > 0 && (
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-2">
                      Applied
                    </div>
                  )}

                  {onUndoLatest && (
                    <button
                      onClick={onUndoLatest}
                      className="w-full rounded-md border bg-background/70 px-3 py-2 text-xs font-semibold text-primary hover:bg-muted"
                    >
                      Undo last change
                    </button>
                  )}

                  <AnimatePresence>
                    {history
                      .filter((r) => !justAppliedIds.has(r.id))
                      .map((r) => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="w-full min-w-0 flex items-start gap-2 rounded-md border bg-background/60 px-2.5 py-2 text-xs">
                            <div className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              {recIcon(r.type)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  Applied
                                </span>
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                                  {r.type.replace("_", " ")}
                                </span>
                              </div>
                              <div className="min-w-0 break-words font-medium leading-snug">
                                {r.title}
                              </div>
                              <div className="mt-1 break-words text-[11px] text-muted-foreground">
                                {r.reason}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>
              )}

              {history.length === 0 &&
                activeRecommendations.length === 0 &&
                justAppliedRecs.length === 0 &&
                !isGenerating && (
                  <div className="text-xs text-muted-foreground">
                    No recommendations yet.
                  </div>
                )}
            </div>
          </ScrollArea>
        ) : (
          /* ===== Chat Log Tab ===== */
          <ScrollArea className="h-full">
            <ChatLog
              userMessages={unifiedMessages}
              assistantReplies={llmReplies}
              fullHeight
            />
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
            Voice and text both influence recommendations.
          </div>
        </SidebarFooter>
      </div>
    </>
  );
}
