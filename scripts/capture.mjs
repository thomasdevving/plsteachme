import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const out='.impeccable/review';await mkdir(out,{recursive:true});
const browser=await chromium.launch();const errors=[];
for(const [name,width,colorScheme] of [['brand-desktop',1280,'light'],['brand-mobile',375,'light'],['brand-dark',375,'dark']]) {
 const context=await browser.newContext({viewport:{width,height:900},colorScheme,reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3100/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${out}/${name}.png`,fullPage:true});await page.screenshot({path:`${out}/${name}-hero.png`});
 await page.getByRole('button',{name:'Explore preview: Do your laundry',exact:true}).click();await page.getByRole('button',{name:'Next preview step',exact:true}).click();await page.locator('#module-preview').screenshot({path:`${out}/${name}-preview.png`});
 console.log(JSON.stringify({name,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));await context.close();
}
await browser.close();if(errors.length){console.error(errors);process.exitCode=1;}
