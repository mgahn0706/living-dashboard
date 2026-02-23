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
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/* =======================================================
   Types
======================================================= */

type UnifiedMessage = {
  id: string;
  source: "voice" | "text";
  text: string;
  timestamp: number;
  lang?: string;
};

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
    const voiceMsgs = conversation.map((v) => ({
      id: v.id,
      source: "voice" as const,
      text: v.text,
      timestamp: v.timestamp,
      lang: v.lang,
    }));

    const textMsgs = textChats.map((t, i) => ({
      id: `text-${i}`,
      source: "text" as const,
      text: t,
      timestamp: Date.now() - i,
    }));

    return [...voiceMsgs, ...textMsgs];
  }, [conversation, textChats]);

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
          <div className="flex flex-col gap-4">
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

            <AnimatePresence>
              {history.map((r, index) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="rounded-md border bg-background/60 px-2.5 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                          {r.type.replace("_", " ")}
                        </span>
                        {index === 0 && onUndoLatest && (
                          <button
                            onClick={onUndoLatest}
                            className="text-[10px] font-medium text-primary hover:underline"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {r.reason}
                    </div>
                  </div>
                </motion.div>
              ))}
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
              <span>Chat log</span>
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
