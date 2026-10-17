import { useEffect, useRef, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import {
  parseProgress,
  type LearningProgress,
  type LessonProgress,
} from "../../lib/learning-progress";
import type { SkillId } from "../../lib/config";

const key = "plsteach.mobile.learning.v1";
export function useProgress() {
  const [progress, setProgress] = useState<LearningProgress>({
    version: 1,
    lessons: {},
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(progress);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    Preferences.get({ key })
      .then(({ value }) => {
        if (!active) return;
        current.current = parseProgress(value);
        setProgress(current.current);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setError(
          "Saved progress could not be loaded. Close and reopen the app to try again.",
        );
      });
    return () => {
      active = false;
    };
  }, []);
  function update(skill: SkillId, lesson: LessonProgress | null) {
    if (!ready) return;
    const next = {
      ...current.current,
      lessons: { ...current.current.lessons },
    };
    if (lesson) next.lessons[skill] = lesson;
    else delete next.lessons[skill];
    current.current = next;
    setProgress(next);
    // Serialize writes so rapid taps cannot replace newer progress with an old save.
    const value = JSON.stringify(next);
    writes.current = writes.current
      .then(() => Preferences.set({ key, value }))
      .then(() => setError(""))
      .catch(() =>
        setError(
          "Progress could not be saved. You can keep practicing, but these changes may be lost when you close the app.",
        ),
      );
  }
  return { progress, ready, error, update };
}
