import { useEffect, useRef, useState } from "react";

/* ===================== Types ===================== */

export type VoiceUtterance = {
  id: string;
  text: string;
  lang: string;
  timestamp: number;
};

export type UseVoiceInputReturn = {
  isSupported: boolean;
  isListening: boolean;
  partial: string;
  conversation: VoiceUtterance[];
  start: () => void;
  stop: () => void;
  clearConversation: () => void;
  restoreConversation: (items: VoiceUtterance[]) => void;
};

/* ===================== Hook ===================== */

export default function useVoiceInput({
  lang,
  onFinal,
}: {
  lang: string;
  onFinal?: (text: string) => void;
}): UseVoiceInputReturn {
  /* ---------- refs ---------- */

  const recognitionRef = useRef<any>(null);

  // 🔥 onFinal을 ref로 관리 (루프 방지 핵심)
  const onFinalRef = useRef<typeof onFinal>(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const shouldListenRef = useRef(false);
  const recognitionActiveRef = useRef(false);

  /* ---------- states ---------- */

  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [conversation, setConversation] = useState<VoiceUtterance[]>([]);

  /* ===================== Init ===================== */

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      setIsListening(true);
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;

      if (shouldListenRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current && !recognitionActiveRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        }, 200);
      } else {
        setIsListening(false);
        setPartial("");
      }
    };

    recognition.onerror = () => {
      recognitionActiveRef.current = false;
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? "";

        if (res.isFinal) finalText += text;
        else interim += text;
      }

      if (interim) {
        setPartial(interim);
      }

      if (finalText) {
        const cleaned = finalText.trim();
        if (!cleaned) return;

        setConversation((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: cleaned,
            lang,
            timestamp: Date.now(),
          },
        ]);

        setPartial("");

        // 🔥 ref 사용 (dependency loop 차단)
        onFinalRef.current?.(cleaned);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;

      if (recognitionActiveRef.current) {
        try {
          recognition.stop();
        } catch {}
      }
    };
  }, [lang]); // 🔥 onFinal 제거

  /* ===================== Controls ===================== */

  const start = () => {
    if (!recognitionRef.current || recognitionActiveRef.current) return;

    shouldListenRef.current = true;

    try {
      recognitionRef.current.start();
    } catch {}
  };

  const stop = () => {
    shouldListenRef.current = false;

    if (recognitionActiveRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch {}
    }

    setPartial("");
  };

  const clearConversation = () => {
    setConversation([]);
    setPartial("");
  };

  const restoreConversation = (items: VoiceUtterance[]) => {
    setConversation(
      Array.isArray(items)
        ? items.filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.text === "string" &&
              typeof item.lang === "string" &&
              typeof item.timestamp === "number"
          )
        : []
    );
    setPartial("");
  };

  /* ===================== Return ===================== */

  return {
    isSupported,
    isListening,
    partial,
    conversation,
    start,
    stop,
    clearConversation,
    restoreConversation,
  };
}
