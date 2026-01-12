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

export default function RecommendationSidebar({
  recs,
  onAccept,
}: {
  recs: Recommendation[];
  onAccept: (r: Recommendation) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 추천이 오면 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [recs]);

  return (
    <Sidebar
      collapsible="offcanvas"
      side="right"
      className="border-l bg-sidebar h-screen flex flex-col"
    >
      {/* Header */}
      <SidebarHeader className="border-b p-4 shrink-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconSparkles className="size-5" />
              </div>
              <div
                className="flex flex-col gap-0.5 leading-none"
                onClick={() => {
                  console.log(recs);
                }}
              >
                <span className="font-semibold">AI Recommendations</span>
                <span className="text-xs text-muted-foreground">
                  Minimal dashboard changes
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="flex flex-col gap-4 pb-4">
            {recs.map((r) => (
              <RecommendationItem
                key={r.id}
                recommendation={r}
                onAccept={onAccept}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3 text-[10px] text-muted-foreground/60 shrink-0">
        Suggestions are optional and reversible.
      </SidebarFooter>
    </Sidebar>
  );
}
