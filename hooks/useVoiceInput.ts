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
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);

  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);

  // 현재 발화 (UI용)
  const [partial, setPartial] = useState("");

  // 🔥 누적 대화
  const [conversation, setConversation] = useState<VoiceUtterance[]>([]);

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
      setIsListening(true);
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        recognition.start();
      } else {
        setIsListening(false);
        setPartial("");
      }
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

    recognition.onerror = () => {
      if (shouldListenRef.current) {
        recognition.stop();
        recognition.start();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      recognition.stop();
    };
  }, [lang, onFinal]);

  /* ===================== Controls ===================== */

  const start = () => {
    if (isListening) return;
    shouldListenRef.current = true;
    recognitionRef.current?.start();
  };

  const stop = () => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setPartial("");
  };

  const clearConversation = () => {
    setConversation([]);
    setPartial("");
  };

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
