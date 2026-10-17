import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { skillIds } from '../../lib/config';
import { modules } from '../../lib/modules';
import { en } from '../../messages/en';

test('all nine lessons can be completed, reviewed and restarted without external services', async ({page})=>{
  test.setTimeout(90000);
  const errors: string[]=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/demo');
  const choices = page.getByRole('group',{name:'Choose a lesson'});
  const player = page.locator('.lesson-player');
  await expect(choices.getByRole('button')).toHaveCount(9);
  for (const skill of skillIds) {
    const lesson = modules[skill];
    await choices.getByRole('button',{name:en.skills.names[skill],exact:true}).click();
    await expect(player).toHaveAttribute('data-skill',skill);
    await expect(player.getByRole('button',{name:'Previous lesson step'})).toBeDisabled();
    await player.getByText('What you’ll need',{exact:true}).click();
    await expect(player.locator('.lesson-materials li')).toHaveCount(lesson.materials.length);
    for (let step=0;step<lesson.steps.length;step++) {
      await expect(player.locator('.lesson-copy h4')).toHaveText(lesson.steps[step].title);
      await expect(player.locator('.lesson-check')).toContainText(lesson.steps[step].check);
      await expect(player.locator('svg[role="img"]')).toHaveAttribute('data-step',String(step+1));
      await expect(player.locator('svg[role="img"]')).toHaveAccessibleName(new RegExp(`^Step ${step+1}:`));
      expect(await player.locator('svg[role="img"]').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
      await player.getByRole('button',{name:step===lesson.steps.length-1?'Finish walkthrough':'Next lesson step',exact:true}).click();
    }
    await expect(player.locator('.lesson-copy')).toContainText(lesson.outcome);
    await expect(player.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(lesson.steps.length));
    await expect(player.locator('.lesson-copy h4')).toBeFocused();
    await player.getByRole('button',{name:'Previous lesson step'}).click();
    await expect(player.locator('.lesson-copy h4')).toHaveText(lesson.steps.at(-1)!.title);
    await player.getByRole('button',{name:'Finish walkthrough'}).click();
    await player.getByRole('button',{name:'Practice again'}).click();
    await expect(player.locator('.lesson-copy h4')).toHaveText(lesson.steps[0].title);
    await expect(player.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
  }
  expect(errors).toEqual([]);
});

test('lesson switching discards completion and library filters close the player',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'}); await page.goto('/');
  await page.getByRole('button',{name:'Explore lesson: Shave',exact:true}).click();
  const player=page.locator('#module-preview');
  await expect(player).toBeFocused();
  await player.getByRole('button',{name:'Next lesson step'}).click();
  await page.getByRole('button',{name:'Explore lesson: Trim your beard',exact:true}).click();
  await expect(player.locator('.lesson-step')).toHaveText('Step 1 of 7');
  await player.getByRole('button',{name:'Close module lesson'}).click();
  await expect(page.getByRole('button',{name:'Explore lesson: Trim your beard',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Explore lesson: Use a drill',exact:true}).click();
  await page.getByRole('button',{name:'Personal care'}).click();
  await expect(player).toHaveCount(0);
  await expect(page.locator('.skill-card')).toHaveCount(2);
});

test('new artwork plays once, holds, replays, pauses offscreen and respects preference changes',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'}); await page.goto('/demo');
  await page.getByRole('group',{name:'Choose a lesson'}).getByRole('button',{name:'Shave',exact:true}).click();
  const art=page.locator('.skill-motion');
  await art.scrollIntoViewIfNeeded();
  await expect.poll(()=>art.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running'))).toBe(true);
  await expect.poll(()=>art.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running')),{timeout:3500}).toBe(false);
  await page.getByRole('button',{name:'Replay this lesson step'}).click();
  await expect.poll(()=>art.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running'))).toBe(true);
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  await expect.poll(()=>art.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='paused'))).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>art.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running'||a.playState==='paused'))).toBe(false);
});

test('expanded lessons and completion remain accessible without mobile overflow',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const width of [375,1280]) {
    await page.setViewportSize({width,height:900}); await page.goto('/demo');
    await page.getByRole('group',{name:'Choose a lesson'}).getByRole('button',{name:'Use a drill',exact:true}).click();
    await page.getByText('What you’ll need',{exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  }
});
