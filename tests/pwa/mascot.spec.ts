import { expect, test } from '@playwright/test';
import { downloadFromLesson } from './helpers';

test('the download companion renders on the website and download library at narrow and desktop widths',async({page})=>{
  for(const width of [320,390,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    const mascot=page.locator('.app-download .download-mascot');
    await expect(page.locator('.app-download-window')).toBeVisible();
    await expect(page.locator('.app-download-step')).toHaveText('Wrap the wide end behind.');
    await mascot.scrollIntoViewIfNeeded();
    await expect(mascot).toBeVisible();
    await expect.poll(()=>mascot.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.goto('/learn/offline');
    await expect(page.locator('.offline-title-row .download-mascot')).toBeVisible();
    await expect(page.locator('.offline-title-row .download-mascot')).toHaveAttribute('src','/mascots/offline-practice.webp');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }
});

test('the download library mascot is available after a fresh offline navigation',async({context,page})=>{
  await downloadFromLesson(page,'tie');
  await context.setOffline(true);
  const images:boolean[]=[];
  page.on('response',response=>{if(response.url().endsWith('/mascots/offline-practice.webp'))images.push(response.fromServiceWorker());});
  await page.goto('/learn');
  const mascot=page.locator('.offline-title-row .download-mascot');
  await expect.poll(()=>mascot.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  expect(images).toContain(true);
});
