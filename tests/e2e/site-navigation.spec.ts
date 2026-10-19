import { test, expect } from '@playwright/test';

test('back to the top returns to the top of every page',async({page})=>{
  for(const path of ['/','/learn','/subscriptions']){
    await page.goto(path);
    await page.evaluate(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'instant'}));
    await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(300);
    await page.locator('footer a[href="#top"]').click();
    await expect.poll(()=>page.evaluate(()=>window.scrollY),{timeout:5000}).toBe(0);
  }
});

test('watch the demo glides slowly so the phone visibly turns into the demo',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');
  const device=page.locator('.journey-device');
  await expect(device).toHaveAttribute('data-mode','hero');
  await page.locator('.hero a[href="#demo"]').click();
  // Partway through, the phone is still moving rather than already in the demo.
  await page.waitForTimeout(900);
  await expect(device).toHaveAttribute('data-mode','moving');
  const midway=await page.evaluate(()=>window.scrollY);
  expect(midway).toBeGreaterThan(0);
  await expect(device).toHaveAttribute('data-mode','demo',{timeout:5000});
  await expect(page).toHaveURL(/#demo$/);
});

test('scrolling yourself takes over from the glide, and reduced motion jumps straight there',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');
  await page.locator('.hero a[href="#demo"]').click();
  await page.waitForTimeout(500);
  await page.mouse.wheel(0,-200);
  const stopped=await page.evaluate(()=>window.scrollY);
  await page.waitForTimeout(1200);
  expect(Math.abs(await page.evaluate(()=>window.scrollY)-stopped)).toBeLessThan(260);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.locator('.hero a[href="#demo"]').click();
  await expect(page.locator('.journey-device')).toHaveAttribute('data-mode','demo',{timeout:1000});
});
