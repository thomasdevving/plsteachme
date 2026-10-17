import sharp from 'sharp';
test.use({serviceWorkers:'block'});
import { installActiveTrial } from '../e2e/trial-fixture';
import { test, expect } from "@playwright/test";
test.beforeEach(async({page})=>installActiveTrial(page));
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
  await page.evaluate(() => {
    for (const key of ['plsteach.learning.v1','plsteach.published-progress.v1.lesson.1','plsteach:attribution','plsteach.me:lesson:tie-four-in-hand']) localStorage.setItem(key,'fixture');
    sessionStorage.setItem('plsteach:attribution','fixture');
    localStorage.setItem('unrelated-setting','preserve');
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: c.delete, exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(c.deleted);
  expect(await page.evaluate(() => ({remaining:Object.keys(localStorage).filter(key=>key.startsWith('plsteach')),session:Object.keys(sessionStorage).filter(key=>key.startsWith('plsteach')),unrelated:localStorage.getItem('unrelated-setting')}))).toEqual({remaining:[],session:[],unrelated:'preserve'});
  await page.goto("/coach/eval");
  await expect(page.getByText(c.emptyEval)).toBeVisible();
});
test('production verification requires an account session and rejects invalid input',async({request})=>{
 const configResponse=await request.get('/api/config');const config=await configResponse.json();expect(config.mock).toBe(false);
 const invalid=await request.post('/api/verify-step',{data:{frames:[]}});expect(invalid.status()).toBe(400);
 const jpeg=await sharp({create:{width:8,height:8,channels:3,background:'#ece6db'}}).jpeg().toBuffer();
 const response=await request.post('/api/verify-step',{headers:{Origin:new URL(configResponse.url()).origin},data:{skillId:'tie-four-in-hand',stepId:'drape',frames:[jpeg.toString('base64')],intake:{},attemptNumber:1}});
 expect([401,403,503]).toContain(response.status());expect(await response.json()).toHaveProperty('error');
});

test("real MediaPipe models load on a camera stream and pause cleanly", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  // Models and simulated camera are real; provider availability is a fixture.
  await page.route('**/api/config', route => route.fulfill({json:{available:true,mock:false}}));
  await page.route('**/api/verify-step', route => route.fulfill({status:503,json:{error:'offline'}}));
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
