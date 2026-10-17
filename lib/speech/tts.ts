let settle: (() => void) | undefined;
export function stopSpeech() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
  settle?.();
  settle = undefined;
}
export function speak(text: string, rate = 0.95): Promise<void> {
  stopSpeech();
  if (typeof window === "undefined" || !window.speechSynthesis || !text)
    return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find(
        (v) =>
          v.lang.startsWith("en") && /natural|samantha|google/i.test(v.name),
      ) ??
      voices.find((v) => v.lang.startsWith("en")) ??
      null;
    const finish = () => {
      clearTimeout(timer);
      if (settle === finish) settle = undefined;
      resolve();
    };
    const timer = setTimeout(
      finish,
      Math.max(5000, text.split(/\s+/).length * 700),
    );
    settle = finish;
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  });
}
