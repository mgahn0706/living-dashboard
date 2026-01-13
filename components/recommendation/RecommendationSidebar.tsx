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
import { IconSparkles } from "@tabler/icons-react";

import RecommendationItem from "./RecommendationItem";

import { useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ===================== AI Thinking ===================== */

function AIThinking() {
  return (
    <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
      <IconSparkles className="size-4 animate-pulse text-primary" />
      <span className="animate-[fade_1.5s_ease-in-out_infinite]">
        Analyzing discussion context…
      </span>
    </div>
  );
}

/* ===================== Sidebar ===================== */

export default function RecommendationSidebar({
  recs,
  onAccept,
  isGenerating = false,
}: {
  recs: Recommendation[];
  onAccept: (r: Recommendation) => void;
  /** 새 추천 생성 중일 때 */
  isGenerating?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 추천이 오면 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [recs, isGenerating]);

  const lastId = recs.at(-1)?.id;

  return (
    <Sidebar
      collapsible="offcanvas"
      side="right"
      className="border-l bg-sidebar h-screen flex flex-col"
    >
      {/* ================= Header ================= */}
      <SidebarHeader className="border-b p-3.5 shrink-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconSparkles className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">AI Recommendations</span>
                <span className="text-xs text-muted-foreground">
                  Minimal dashboard changes
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ================= Content ================= */}
      <SidebarContent className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="flex flex-col gap-4 pb-4">
            {/* AI thinking indicator */}
            {isGenerating && <AIThinking />}

            <AnimatePresence initial={false}>
              {recs.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{
                    duration: 0.35,
                    ease: "easeOut",
                  }}
                  className="relative"
                >
                  <RecommendationItem recommendation={r} onAccept={onAccept} />
                </motion.div>
              ))}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </SidebarContent>

      {/* ================= Footer ================= */}
      <SidebarFooter className="p-3 text-[10px] text-muted-foreground/60 shrink-0">
        Suggestions are generated based on interaction focus and can be safely
        undone.
      </SidebarFooter>
    </Sidebar>
  );
}
