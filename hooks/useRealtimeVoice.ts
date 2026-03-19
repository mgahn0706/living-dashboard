"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PcmPlayer } from "@/lib/audio/pcmPlayer";

/* ===================== Types ===================== */

export type UseRealtimeVoiceReturn = {
  /** Whether the WebSocket connection is currently open */
  isConnected: boolean;
  /** Whether AI audio is currently playing */
  isSpeaking: boolean;
  /** Whether voice output is muted */
  isMuted: boolean;
  /** Connect to the Realtime API (call on mic start) */
  connect: () => Promise<void>;
  /** Disconnect from the Realtime API */
  disconnect: () => void;
  /** Send a user text message and request an audio response */
  sendText: (text: string) => void;
  /** Send a follow-up message for recommendation narration */
  sendNarration: (text: string) => void;
  /** Stop current audio playback + cancel server response (barge-in) */
  interrupt: () => void;
  /** Toggle mute on/off */
  toggleMute: () => void;
};

/* ===================== Constants ===================== */

const REALTIME_WS_URL = "wss://api.openai.com/v1/realtime";
const REALTIME_MODEL = "gpt-4o-mini-realtime-preview";
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 3;

/* ===================== Hook ===================== */

export default function useRealtimeVoice(): UseRealtimeVoiceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalDisconnectRef = useRef(false);

  /* ---------- PcmPlayer lifecycle ---------- */

  useEffect(() => {
    const player = new PcmPlayer();
    player.onPlaybackEnd = () => setIsSpeaking(false);
    playerRef.current = player;
    return () => {
      player.destroy();
    };
  }, []);

  useEffect(() => {
    playerRef.current?.setVolume(isMuted ? 0 : 1);
  }, [isMuted]);

  /* ---------- WebSocket helpers ---------- */

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    let data: any;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (data.type) {
      case "session.created":
        console.log("[Realtime] Session created");
        break;

      case "response.audio.delta":
        if (data.delta) {
          setIsSpeaking(true);
          playerRef.current?.enqueue(data.delta);
        }
        break;

      case "response.audio.done":
      case "response.done":
        // Audio delivery complete; playback may still be ongoing in the
        // PcmPlayer buffer. isSpeaking will be cleared by onPlaybackEnd.
        break;

      case "error":
        console.error("[Realtime] Server error:", data.error);
        break;

      default:
        break;
    }
  }, []);

  /* ---------- Connect / Disconnect ---------- */

  const connectWs = useCallback(
    (clientSecret: string) => {
      const url = `${REALTIME_WS_URL}?model=${encodeURIComponent(REALTIME_MODEL)}`;

      const ws = new WebSocket(url, [
        "realtime",
        `openai-insecure-api-key.${clientSecret}`,
        "openai-beta.realtime-v1",
      ]);

      ws.onopen = () => {
        console.log("[Realtime] WebSocket connected");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onclose = (ev) => {
        console.log("[Realtime] WebSocket closed:", ev.code);
        setIsConnected(false);
        wsRef.current = null;

        if (
          !intentionalDisconnectRef.current &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttemptsRef.current++;
          console.log(
            `[Realtime] Reconnecting (attempt ${reconnectAttemptsRef.current})…`
          );
          setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            doConnect();
          }, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = (err) => {
        console.error("[Realtime] WebSocket error:", err);
      };

      wsRef.current = ws;
    },
    [handleMessage]
  );

  const doConnect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    intentionalDisconnectRef.current = false;

    try {
      await playerRef.current?.init();

      const res = await fetch("/api/realtime-session", { method: "POST" });
      if (!res.ok) {
        console.error("[Realtime] Failed to get session:", res.status);
        return;
      }

      const { clientSecret } = await res.json();
      if (!clientSecret) {
        console.error("[Realtime] No client secret returned");
        return;
      }

      connectWs(clientSecret);
    } catch (err) {
      console.error("[Realtime] Connection failed:", err);
    }
  }, [connectWs]);

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    playerRef.current?.flush();
    setIsSpeaking(false);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  /* ---------- Messaging ---------- */

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: text.trim() }],
        },
      });

      sendEvent({
        type: "response.create",
        response: { modalities: ["audio"] },
      });
    },
    [sendEvent]
  );

  const sendNarration = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `[SYSTEM NOTE - Narrate the following recommendation results to the user in a natural, conversational way. Be brief.]\n\n${text.trim()}`,
            },
          ],
        },
      });

      sendEvent({
        type: "response.create",
        response: { modalities: ["audio"] },
      });
    },
    [sendEvent]
  );

  const interrupt = useCallback(() => {
    playerRef.current?.flush();
    setIsSpeaking(false);
    sendEvent({ type: "response.cancel" });
  }, [sendEvent]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  /* ---------- Cleanup on unmount ---------- */

  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true;
      wsRef.current?.close();
    };
  }, []);

  return {
    isConnected,
    isSpeaking,
    isMuted,
    connect: doConnect,
    disconnect,
    sendText,
    sendNarration,
    interrupt,
    toggleMute,
  };
}
