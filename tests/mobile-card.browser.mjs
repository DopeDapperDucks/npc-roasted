// Run against a local server with @playwright/test installed in the test environment.
import { chromium, webkit, devices, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:3000';
const artwork=`data:image/png;base64,${readFileSync('public/npc/npc-777.png').toString('base64')}`;
const fixture=id=>({tokenId:String(id),collection:'npc',imageDataUrl:artwork,headline:'Background check',roast:'Standing still. Still somehow late.',stats:Array.from({length:4},(_,i)=>({label:`Stat ${i}`,value:'Still standing',score:43+i})),cookedLevel:76,traitsSeen:[]});
for(const [name,engine,options] of [['iphone',webkit,devices['iPhone 13']],['android',chromium,devices['Pixel 7']],['desktop',chromium,{viewport:{width:1280,height:900}}]]){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({...options,acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let calls=0;
 await page.route('**/api/roast',async route=>{calls++;const body=route.request().postDataJSON();await route.fulfill({json:fixture(body.tokenId)});});
 await page.goto(origin);
 await page.getByLabel('Token ID',{exact:true}).fill('777');
 await page.getByRole('button',{name:'Generate roast',exact:true}).click();
 await expect(page.getByRole('link',{name:'Download PNG'})).toBeVisible({timeout:30000});
 await expect(page.locator('#saved-card img')).toHaveJSProperty('naturalWidth',1200);
 await expect(page.locator('#saved-card img')).toHaveJSProperty('naturalHeight',1600);
 const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(size.scroll).toBeLessThanOrEqual(size.width);
 if(name!=='desktop')expect(await page.locator('.report').evaluate(e=>e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download PNG'}).click();
 const download=await downloadEvent;
 expect(download.suggestedFilename()).toBe('npc-roasted-npc-777.png');
 const meta=await sharp(await download.path()).metadata();expect(meta.width).toBe(1200);expect(meta.height).toBe(1600);expect(meta.format).toBe('png');
 const popupEvent=page.waitForEvent('popup');
 await page.getByRole('link',{name:'Open full-size card'}).click();
 const popup=await popupEvent;await popup.waitForLoadState();await popup.close();
 const previous=await page.getByRole('link',{name:'Download PNG'}).getAttribute('href');
 await page.getByLabel('Token ID',{exact:true}).fill('875');await page.getByRole('button',{name:'Generate roast',exact:true}).click();
 await expect(page.getByRole('link',{name:'Download PNG'})).toHaveAttribute('download','npc-roasted-npc-875.png');
 const staleRevoked=await page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},previous);expect(staleRevoked).toBe(true);
 expect(calls).toBe(2);expect(errors).toEqual([]);
 await page.screenshot({path:`/tmp/npc-card-${name}.png`,fullPage:true});
 console.log(`PASS ${name}: preview, layout, PNG download/decode, full-size view, regeneration and URL cleanup`);
 await context.close();await browser.close();
}
// Exercise file sharing and export recovery without invoking real device share UI.
const browser=await chromium.launch();
for(const mode of ['success','cancel','blocked','retry','legacy-canvas','no-share']){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.addInitScript(mode=>{
  if(mode==='legacy-canvas')CanvasRenderingContext2D.prototype.roundRect=undefined;
  if(mode==='retry'){
   const original=HTMLCanvasElement.prototype.toBlob;let first=true;
   HTMLCanvasElement.prototype.toBlob=function(cb,...args){if(first){first=false;cb(null);}else original.call(this,cb,...args);};
  }
  Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>mode!=='no-share'&&files[0].type==='image/png'});
  Object.defineProperty(navigator,'share',{configurable:true,value:async ({files})=>{
   window.__shared={name:files[0].name,size:files[0].size,active:navigator.userActivation.isActive};
   if(mode==='cancel')throw new DOMException('Canceled','AbortError');
   if(mode==='blocked')throw new DOMException('Blocked','NotAllowedError');
  }});
 },mode);
 await page.route('**/api/roast',route=>route.fulfill({json:fixture(777)}));
 await page.goto(origin);await page.getByLabel('Token ID',{exact:true}).fill('777');await page.getByRole('button',{name:'Generate roast',exact:true}).click();
 if(mode==='retry'){await expect(page.getByRole('button',{name:'Retry card'})).toBeEnabled();await page.getByRole('button',{name:'Retry card'}).click();}
 await expect(page.getByRole('link',{name:'Download PNG'})).toBeVisible();
 if(['success','cancel','blocked'].includes(mode)){
  await page.getByRole('button',{name:'Save / share card'}).click();
  await expect(page.getByRole('button',{name:'Save / share card'})).toBeEnabled();
  const shared=await page.evaluate(()=>window.__shared);expect(shared.active).toBe(true);expect(shared.name).toBe('npc-roasted-npc-777.png');expect(shared.size).toBeGreaterThan(0);
  if(mode==='success')await expect(page.locator('.card-status')).toHaveText('Card shared.');
  if(mode==='blocked')await expect(page.locator('.card-status')).toContainText('Use Download PNG');
  if(mode==='cancel')await expect(page.locator('.card-status')).toHaveText('Your card is ready to view and save.');
 }
 if(mode==='no-share')await expect(page.getByRole('button',{name:'Save / share card'})).toHaveCount(0);
 console.log(`PASS ${mode}`);await page.close();
}
await browser.close();
