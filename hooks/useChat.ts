"use client";

import { useCallback, useRef, useState } from "react";
import { makeChatPrompt, type ChatMessage } from "@/lib/llm/makeChatPrompt";

export type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  source?: "text" | "voice";
};

export function useChat() {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async ({
      text,
      source = "text",
      views,
      dataSchema,
    }: {
      text: string;
      source?: "text" | "voice";
      views: any[];
      dataSchema?: any;
    }) => {
      const userEntry: ChatEntry = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: Date.now(),
        source,
      };

      setMessages((prev) => [...prev, userEntry]);
      setIsLoading(true);
      setStreamingText("");

      // Build chat history from existing messages + new user message
      const chatHistory: ChatMessage[] = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: text },
      ];

      const apiMessages = makeChatPrompt({
        views,
        dataSchema,
        chatHistory,
      });

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          console.error("Chat API returned", res.status);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamingText(fullText);
        }

        const assistantEntry: ChatEntry = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: fullText.trim(),
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantEntry]);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Chat error:", err);
        }
      } finally {
        setIsLoading(false);
        setStreamingText("");
        abortRef.current = null;
      }
    },
    [messages]
  );

  const restoreMessages = useCallback((entries: ChatEntry[]) => {
    setMessages(
      Array.isArray(entries)
        ? entries.filter(
            (e) =>
              e &&
              typeof e.id === "string" &&
              typeof e.content === "string" &&
              (e.role === "user" || e.role === "assistant")
          )
        : []
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingText("");
    setIsLoading(false);
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isLoading,
    streamingText,
    sendMessage,
    restoreMessages,
    clearMessages,
  };
}
