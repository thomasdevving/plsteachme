// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyLessonProgress,
  readProgress,
  saveLessonProgress,
} from "../lib/learning-progress";
import {
  applyRemote,
  localEntries,
  startProgressSync,
} from "../lib/progress-sync";

const published = "22222222-2222-4222-8222-222222222222";
const lesson = (step: number, updatedAt: number) => ({
  ...emptyLessonProgress("shaving"),
  step,
  updatedAt,
});
let stopSync: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  stopSync = undefined;
});
afterEach(() => {
  stopSync?.();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("account progress sync", () => {
  it("applies only valid account copies", () => {
    expect(
      applyRemote({
        lessonKey: "builtin:shaving",
        data: lesson(2, 10),
        updatedAt: 10,
      }),
    ).toBe(true);
    expect(readProgress().lessons.shaving?.step).toBe(2);
    expect(
      applyRemote({
        lessonKey: "builtin:shaving",
        data: { ...lesson(2, 10), step: 99 },
        updatedAt: 11,
      }),
    ).toBe(false);
    expect(
      applyRemote({
        lessonKey: "builtin:notaskill",
        data: lesson(1, 10),
        updatedAt: 10,
      }),
    ).toBe(false);
    expect(
      applyRemote({
        lessonKey: `published:${published}:v3`,
        data: { step: 1, completed: false, results: ["manual"] },
        updatedAt: 20,
      }),
    ).toBe(true);
    expect(
      applyRemote({
        lessonKey: `published:${published}:v3`,
        data: { step: "1" },
        updatedAt: 21,
      }),
    ).toBe(false);
    expect(localEntries().get(`published:${published}:v3`)).toEqual({
      data: { step: 1, completed: false, results: ["manual"] },
      updatedAt: 20,
    });
  });
  it("merges newer account copies and uploads newer local ones", async () => {
    saveLessonProgress("shaving", lesson(1, 100));
    saveLessonProgress("tie", {
      ...emptyLessonProgress("tie"),
      step: 3,
      updatedAt: 500,
    });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) =>
        init?.method === "POST"
          ? new Response("{}")
          : Response.json({
              progress: [
                {
                  lessonKey: "builtin:shaving",
                  data: lesson(4, 200),
                  updatedAt: 200,
                },
                {
                  lessonKey: "builtin:tie",
                  data: {
                    ...emptyLessonProgress("tie"),
                    step: 1,
                    updatedAt: 300,
                  },
                  updatedAt: 300,
                },
              ],
            }),
      );
    const stop = startProgressSync();
    await vi.waitFor(() =>
      expect(fetch.mock.calls.some((call) => call[1]?.method === "POST")).toBe(
        true,
      ),
    );
    expect(readProgress().lessons.shaving?.step).toBe(4);
    expect(readProgress().lessons.tie?.step).toBe(3);
    const posts = fetch.mock.calls
      .filter((call) => call[1]?.method === "POST")
      .map((call) => JSON.parse(String(call[1]!.body)).lessonKey);
    expect(posts).toEqual(["builtin:tie"]);
    // Later local changes go up after a short pause.
    saveLessonProgress("shaving", lesson(5, 900));
    await vi.advanceTimersByTimeAsync(900);
    expect(
      fetch.mock.calls
        .filter((call) => call[1]?.method === "POST")
        .map((call) => JSON.parse(String(call[1]!.body)).lessonKey),
    ).toEqual(["builtin:tie", "builtin:shaving"]);
    stop();
  });
  it("recovers from an initial GET failure without uploading before the merge", async () => {
    let available = false;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) =>
        init?.method === "POST"
          ? Response.json({})
          : available
            ? Response.json({
                progress: [
                  {
                    lessonKey: "builtin:shaving",
                    data: lesson(4, 200),
                    updatedAt: 200,
                  },
                ],
              })
            : new Response("{}", { status: 503 }),
      );
    stopSync = startProgressSync();
    await vi.advanceTimersByTimeAsync(1);
    saveLessonProgress("shaving", lesson(1, 100));
    await vi.advanceTimersByTimeAsync(900);
    expect(
      fetch.mock.calls.filter((call) => call[1]?.method === "POST"),
    ).toHaveLength(0);
    available = true;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(1);
    expect(readProgress().lessons.shaving?.step).toBe(4);
    saveLessonProgress("shaving", lesson(5, 300));
    await vi.advanceTimersByTimeAsync(900);
    expect(
      fetch.mock.calls.filter((call) => call[1]?.method === "POST"),
    ).toHaveLength(1);
  });
  it("retries a failed POST with the original timestamp and acknowledges only success", async () => {
    saveLessonProgress("shaving", lesson(1, 100));
    let writes = 0;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) =>
        init?.method === "POST"
          ? new Response("{}", { status: ++writes === 1 ? 503 : 200 })
          : Response.json({ progress: [] }),
      );
    stopSync = startProgressSync();
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(writes).toBe(2);
    const posts = fetch.mock.calls
      .filter((call) => call[1]?.method === "POST")
      .map((call) => JSON.parse(String(call[1]!.body)));
    expect(posts[1]).toEqual(posts[0]);
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(10000);
    expect(writes).toBe(2);
  });
  it("keeps newer edits pending while an earlier write is in flight", async () => {
    saveLessonProgress("shaving", lesson(1, 100));
    let release!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) =>
        init?.method === "POST"
          ? ++writes === 1
            ? first
            : Response.json({})
          : Response.json({ progress: [] }),
      );
    stopSync = startProgressSync();
    await vi.advanceTimersByTimeAsync(1);
    saveLessonProgress("shaving", lesson(2, 200));
    await vi.advanceTimersByTimeAsync(900);
    expect(writes).toBe(1);
    release(Response.json({}));
    await vi.advanceTimersByTimeAsync(10);
    const posts = fetch.mock.calls
      .filter((call) => call[1]?.method === "POST")
      .map((call) => JSON.parse(String(call[1]!.body)).data.step);
    expect(posts).toEqual([1, 2]);
  });
  it("does not move a published edit forward in time when a failed upload retries", async () => {
    localStorage.setItem(
      `plsteach.published-progress.v1.${published}.1`,
      JSON.stringify({ step: 1, completed: false, results: ["manual"] }),
    );
    let writes = 0;
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) =>
        init?.method === "POST"
          ? new Response("{}", { status: ++writes === 1 ? 503 : 200 })
          : Response.json({ progress: [] }),
      );
    stopSync = startProgressSync();
    await vi.advanceTimersByTimeAsync(6000);
    const posts = fetch.mock.calls
      .filter((call) => call[1]?.method === "POST")
      .map((call) => JSON.parse(String(call[1]!.body)));
    expect(posts).toHaveLength(2);
    expect(posts[1].updatedAt).toBe(posts[0].updatedAt);
  });
  it("cancels pending reads and retries when the learner leaves", async () => {
    let release!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(first);
    stopSync = startProgressSync();
    const signal = fetch.mock.calls[0][1]!.signal!;
    stopSync();
    stopSync = undefined;
    expect(signal.aborted).toBe(true);
    release(Response.json({ progress: [] }));
    saveLessonProgress("shaving", lesson(1, 100));
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
