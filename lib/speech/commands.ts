export type VoiceCommand = "done" | "repeat" | "back" | "show" | "help";
export function parseCommand(
  text: string,
): { command: VoiceCommand } | { question: string } | null {
  const value = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  const commands: Record<string, VoiceCommand> = {
    done: "done",
    klaar: "done",
    next: "done",
    volgende: "done",
    repeat: "repeat",
    herhaal: "repeat",
    back: "back",
    terug: "back",
    "show me": "show",
    "laat zien": "show",
    help: "help",
  };
  if (commands[value]) return { command: commands[value] };
  if (/^(how|why|what|which|hoe|waarom|wat|welke)\b/.test(value))
    return { question: text };
  return null;
}
export type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
        resultIndex: number;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
export function recognitionConstructor(): (new () => Recognition) | undefined {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
