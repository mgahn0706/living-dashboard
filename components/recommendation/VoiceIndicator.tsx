import { cn } from "@/lib/utils";

export default function VoiceIndicator({
  isListening,
  onClick,
}: {
  isListening: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition",
        isListening ? "bg-red-500/10 text-red-600" : "hover:bg-muted"
      )}
    >
      <div
        className={cn(
          "size-2 rounded-full",
          isListening ? "bg-red-500 animate-pulse" : "bg-muted-foreground"
        )}
      />
      {isListening ? "Listening…" : "Voice input"}
    </button>
  );
}
