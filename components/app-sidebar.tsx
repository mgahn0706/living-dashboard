"use client";

import * as React from "react";
import {
  IconSend,
  IconUser,
  IconSparkles,
  IconRobotFace,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Mock initial chat state
const initialMessages = [
  {
    id: 1,
    role: "agent",
    content:
      "Hello! I'm your match analysis assistant. How can I help you with the data today?",
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [messages, setMessages] = React.useState(initialMessages);
  const [inputValue, setInputValue] = React.useState("");
  // Ref to auto-scroll to bottom
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newMessage = {
      id: Date.now(),
      role: "user",
      content: inputValue,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "agent",
          content:
            "I'm processing that request. In a real app, I would fetch data from the dashboard context now.",
        },
      ]);
    }, 1000);
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      side="right"
      className="border-l bg-sidebar h-screen flex flex-col"
      {...props}
    >
      {/* Header: Fixed Height */}
      <SidebarHeader className="border-b p-4 shrink-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconRobotFace className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">AI Assistant</span>
                <span className="text-xs text-muted-foreground">Online</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content: Flex-1 to take remaining space, min-h-0 to allow scrolling */}
      <SidebarContent className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex w-full gap-2 ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <Avatar className="size-8 shrink-0">
                  {message.role === "agent" ? (
                    <>
                      <AvatarImage src="/bot-avatar.png" />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <IconSparkles className="size-4" />
                      </AvatarFallback>
                    </>
                  ) : (
                    <>
                      <AvatarImage src="/user-avatar.jpg" />
                      <AvatarFallback>
                        <IconUser className="size-4" />
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>

                <div
                  className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </SidebarContent>

      {/* Footer: Fixed Height */}
      <SidebarFooter className="p-4 pt-2 bg-sidebar shrink-0">
        <form
          onSubmit={handleSendMessage}
          className="relative flex flex-col rounded-xl border bg-background shadow-sm focus-within:ring-1 focus-within:ring-primary/20"
        >
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about match stats..."
            className="min-h-[80px] w-full resize-none border-0 bg-transparent p-3 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="text-[10px] text-muted-foreground/50 pl-2">
              AI can make mistakes.
            </div>
            <Button
              type="submit"
              size="icon"
              className="size-8 rounded-lg"
              disabled={!inputValue.trim()}
            >
              <IconSend className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
