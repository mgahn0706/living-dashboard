import { VoiceUtterance } from "@/hooks/useVoiceInput";

export type RecentRequestMessage = {
  id: string;
  source: "voice" | "text";
  text: string;
  timestamp: number;
  lang?: string;
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function buildRecentRequestMessages({
  conversation,
  textChats,
}: {
  conversation: VoiceUtterance[];
  textChats: string[];
}): RecentRequestMessage[] {
  const voiceMessages = conversation.map((item) => ({
    id: item.id,
    source: "voice" as const,
    text: normalizeText(item.text),
    timestamp: item.timestamp,
    lang: item.lang,
  }));

  const syntheticBase = Date.now();
  const textMessages = textChats.map((text, index) => ({
    id: `text-${index}`,
    source: "text" as const,
    text: normalizeText(text),
    timestamp: syntheticBase + index,
  }));

  return [...voiceMessages, ...textMessages].filter((item) => item.text);
}

export function summarizeRecentRequest(messages: RecentRequestMessage[]) {
  const recent = [...messages]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((item) => item.text)
    .filter(Boolean);

  if (recent.length === 0) {
    return "No recent explicit request.";
  }

  const uniqueRecent = Array.from(new Set(recent));
  return uniqueRecent[uniqueRecent.length - 1];
}
