import { expect, test } from "@playwright/test";
import { skillIds } from "../../lib/config";
import { modules } from "../../lib/modules";
import { downloadFromLesson } from "./helpers";

test("every downloaded lesson step fits short phone screens without scrolling", async ({
  context,
  page,
}) => {
  test.setTimeout(180_000);
  for (const skill of skillIds) await downloadFromLesson(page, skill);
  await context.setOffline(true);
  for (const skill of skillIds) {
    await page.goto(`/learn/${skill}`);
    await expect(page.locator(".app-status-offline")).toBeVisible();
    for (let step = 0; step < modules[skill].steps.length; step++) {
      for (const viewport of [
        { width: 320, height: 568 },
        { width: 375, height: 667 },
        { width: 844, height: 390 },
      ]) {
        await page.setViewportSize(viewport);
        const layout = await page.evaluate(async () => {
          await document.fonts.ready;
          const main = document.querySelector<HTMLElement>(
            ".lesson-screen-main",
          )!;
          const footer = document
            .querySelector(".lesson-screen-footer")!
            .getBoundingClientRect();
          return {
            bodyScroll: document.documentElement.scrollHeight > innerHeight + 1,
            horizontalScroll:
              document.documentElement.scrollWidth > innerWidth + 1,
            instructionScroll: main.scrollHeight > main.clientHeight + 1,
            footerVisible: footer.bottom <= innerHeight + 1,
          };
        });
        expect(
          layout,
          `${skill} step ${step + 1}, ${viewport.width}×${viewport.height}`,
        ).toEqual({
          bodyScroll: false,
          horizontalScroll: false,
          instructionScroll: false,
          footerVisible: true,
        });
      }
      if (step < modules[skill].steps.length - 1)
        await page
          .getByRole("button", { name: "Next lesson step", exact: true })
          .click();
    }
  }
});
