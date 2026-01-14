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

  // 실시간 중간 발화
  partial: string;

  // 누적 대화 로그
  conversation: VoiceUtterance[];

  start: () => void;
  stop: () => void;
  clearConversation: () => void;
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

  // 사용자가 "계속 듣고 싶다"는 의도
  const shouldListenRef = useRef(false);

  // 🔑 실제 SpeechRecognition 실행 상태 (React state ❌)
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

    /* ---------- lifecycle ---------- */

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      setIsListening(true);
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;

      if (shouldListenRef.current) {
        // ⚠️ Chrome 안정화: 한 tick 늦춰 재시작
        setTimeout(() => {
          if (shouldListenRef.current && !recognitionActiveRef.current) {
            try {
              recognition.start();
            } catch {
              // ignore InvalidStateError
            }
          }
        }, 200);
      } else {
        setIsListening(false);
        setPartial("");
      }
    };

    recognition.onerror = () => {
      // ❌ 여기서 start() 호출 금지
      recognitionActiveRef.current = false;
      // onend가 알아서 처리
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
        onFinal?.(cleaned);
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
  }, [lang, onFinal]);

  /* ===================== Controls ===================== */

  const start = () => {
    if (!recognitionRef.current || recognitionActiveRef.current) return;

    shouldListenRef.current = true;

    try {
      recognitionRef.current.start();
    } catch {
      // ignore InvalidStateError
    }
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

  /* ===================== Return ===================== */

  return {
    isSupported,
    isListening,
    partial,
    conversation,
    start,
    stop,
    clearConversation,
  };
}
