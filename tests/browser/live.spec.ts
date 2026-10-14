import { test, expect } from "@playwright/test";
import { liveCopy as c } from "../../lib/copy/en";
test("consent gates camera access and camera failure offers watch-only", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
    });
  });
  await page.goto("/coach/session/tie-four-in-hand?debug=1");
  await page.getByRole("button", { name: c.cameraStart, exact: true }).click();
  await expect(
    page.getByRole("button", { name: c.start, exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}-consent.png`,
    fullPage: true,
  });
  await page.getByRole("checkbox", { name: c.agree }).check();
  await page.getByRole("button", { name: c.start, exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Allow camera access");
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}-camera-error.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: c.watch, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Drape the tie", exact: true }),
  ).toBeVisible();
});
test("eval metrics, frame-free export and delete data work", async ({
  page,
}) => {
  await page.goto("/coach/eval");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("plsteach-me", 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("local"))
          req.result.createObjectStore("local");
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("local", "readwrite");
        tx.objectStore("local").put(
          {
            id: "fixture",
            timestamp: new Date().toISOString(),
            skillId: "tie-four-in-hand",
            stepId: "drape",
            result: {
              verdict: "pass",
              confidence: 0.9,
              errorId: null,
              observation: "Fixture",
              feedback: "",
              latencyMs: 700,
              model: "test-model",
              mock: false,
            },
            truth: "fail",
            clientLatencyMs: 900,
          },
          "eval:fixture",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.reload();
  await expect(page.locator(".false-pass dd")).toHaveText("100.0%");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: c.exportCSV }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.goto("/coach/settings");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: c.delete, exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(c.deleted);
  await page.goto("/coach/eval");
  await expect(page.getByText(c.emptyEval)).toBeVisible();
});
test("API mock checks are identified and bad requests are rejected", async ({
  request,
}) => {
  const config = await (await request.get("/api/config")).json();
  expect(config.mock).toBe(true);
  const invalid = await request.post("/api/verify-step", {
    data: { frames: [] },
  });
  expect(invalid.status()).toBe(400);
  const response = await request.post("/api/verify-step", {
    data: {
      skillId: "tie-four-in-hand",
      stepId: "drape",
      frames: ["/9j/AA=="],
      intake: {},
      attemptNumber: 1,
    },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ mock: true, model: "mock" });
});
test("real MediaPipe models load on a camera stream and pause cleanly", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/coach/session/tie-four-in-hand?debug=1");
  await page.getByRole("button", { name: c.cameraStart, exact: true }).click();
  await page.getByRole("checkbox", { name: c.agree }).check();
  await page.getByRole("button", { name: c.start, exact: true }).click();
  await expect(page.getByText(c.modelsLoading)).not.toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".debug-panel pre").first()).toContainText(
    "bothShouldersVisible",
  );
  await page.getByRole("button", { name: c.pause, exact: true }).click();
  await expect(page.getByText(c.paused)).toBeVisible();
  await page.screenshot({
    path: `.impeccable/review/${info.project.name}-camera.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: c.resume, exact: true }).click();
  await page.getByRole("button", { name: c.stop, exact: true }).click();
  await expect(page.locator("video")).toHaveCount(0);
  expect(errors).toEqual([]);
});
