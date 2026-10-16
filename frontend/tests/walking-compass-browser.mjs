// Real local UI; synthetic accounts, GPS, iOS sensor permissions and routing only.
// No production, provider, or paid API requests are allowed by this harness.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {translate} from '../src/i18n.js';
import {distanceBetween} from '../src/utils/navigationCalculations.js';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.DAL_QA_MODULES?join(process.env.DAL_QA_MODULES,'playwright'):'playwright');
const phase=process.argv[2]||'after',engine=process.argv[3]||'chromium';
const base=process.env.DAL_QA_BASE_URL||'http://127.0.0.1:5195';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.ok(['before','after'].includes(phase)&&['chromium','webkit'].includes(engine));
const output=process.env.DAL_QA_OUTPUT||fileURLToPath(new URL('../../tmp/walking-compass/',import.meta.url));
const shots=fileURLToPath(new URL('../../docs/screenshots/compass-walking-route/',import.meta.url));
await mkdir(output,{recursive:true});await mkdir(shots,{recursive:true});
const sizes=process.env.DAL_QA_VIEWPORTS?JSON.parse(process.env.DAL_QA_VIEWPORTS):[[390,844],[768,1024],[1280,720]];
const languages=process.env.DAL_QA_LANGUAGES?.split(',')||(phase==='before'?['en']:['ar','en','fr']);
const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true}));
const results=[];
try{for(const [width,height]of sizes)for(const lang of languages){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});const page=await ctx.newPage();
 const errors=[],browserNotices=[],unexpected=[];let calls=0,checks=0,routeFailure=false,hold=false,releaseRoute,revoked=false,stale=false;
 const check=(value,message)=>{assert.ok(value,`${engine}/${lang}/${width}: ${message}`);checks++;};
 const user={id:1,name:'QA User',email:'synthetic@example.test'},group={id:10,name:'QA Walking Group',myRole:'OWNER',memberCount:3,status:'ACTIVE',joinCode:'QA123',joinMode:'DIRECT'};
 const members=[{userId:1,id:1,name:user.name,role:'OWNER'},{userId:2,id:2,name:'QA Route Member',role:'MEMBER'},{userId:3,id:3,name:'QA Other Member',role:'MEMBER'}];
 const origin={latitude:24.7136,longitude:46.6753},dest={latitude:24.7146,longitude:46.6755},meeting={id:20,name:'QA Meeting Gate',latitude:24.7146,longitude:46.6748};
 const sharing={sharingEnabled:true,isPaused:false,sharingMode:'ALWAYS',updateIntervalSeconds:15};
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'){
  // Present on unchanged main too: desktop WebKit does not support this viewport hint.
  if(m.text()==='Viewport argument key "interactive-widget" not recognized and ignored.')browserNotices.push(m.text());
  else errors.push(m.text());
 }});
 await page.clock.install({time:new Date()});
 await page.addInitScript(({lang,origin})=>{
  localStorage.setItem('dal-language',lang);
  window.__qa={...origin,gpsDenied:true,sensorDenied:true,sensorRead:false,watches:0,nativePrompts:0};
  Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>{throw Error('Safari-like unsupported query');}}});
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(ok,fail){window.__qa.watches++;const send=()=>window.__qa.gpsDenied?fail({code:1}):ok({coords:{latitude:window.__qa.latitude,longitude:window.__qa.longitude,accuracy:5},timestamp:Date.now()});window.__qa.send=send;setTimeout(send,10);return setInterval(send,1000);},clearWatch(id){clearInterval(id);}}});
  window.DeviceOrientationEvent=class{};window.DeviceOrientationEvent.requestPermission=async()=>{window.__qa.nativePrompts++;return window.__qa.sensorDenied?'denied':'granted';};
  setInterval(()=>{if(window.__qa.sensorRead)window.dispatchEvent(Object.assign(new Event('deviceorientation'),{webkitCompassHeading:0,webkitCompassAccuracy:5}));},100);
 },{lang,origin});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='tile.openstreetmap.org')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tOAAAAAASUVORK5CYII=','base64')});
  if(url.origin!==new URL(base).origin){unexpected.push(url.hostname);return route.abort();}
  if(!url.pathname.startsWith('/api/'))return route.continue();
  const path=url.pathname.replace('/api/v1','');let data;
  if(path==='/user/profile')data=user;
  else if(path==='/security/csrf')data={headerName:'X-CSRF-TOKEN',token:'synthetic'};
  else if(path==='/group/my')data=[group];
  else if(path==='/group/10')data=group;
  else if(path==='/group-member/group/10')data=members;
  else if(path==='/sharing')data=sharing;
  else if(path.startsWith('/sharing/group/'))data={sharingEnabled:true,isPaused:false};
  else if(path==='/meeting-point/group/10')data=meeting;
  else if(path==='/location/group/10'){
   const now=await page.evaluate(()=>Date.now());data=members.map((m,i)=>({...m,...(i===0?origin:i===1?dest:{latitude:24.7156,longitude:46.6763}),accuracy:5,sharingEnabled:!(i===1&&revoked),visibleUntil:null,recordedAt:new Date(now-(i===1&&stale?31000:0)).toISOString()}));
  }
  else if(path==='/location/update')data={...req.postDataJSON(),userId:1,sharingEnabled:true,visibleUntil:null};
  else if(path==='/notification/unread-count')data={count:0};
  else if(path==='/notification/my'||path==='/join-request/my'||path.startsWith('/join-request/group/'))data=[];
  else if(path.startsWith('/group-message/')||path.startsWith('/message/'))data={count:0,content:[],last:true};
  else if(path.endsWith('/walking')){
   calls++;if(hold)await new Promise(resolve=>releaseRoute=resolve);
   const body=req.postDataJSON(),target=body.meetingPoint?meeting:body.memberId===3?{latitude:24.7156,longitude:46.6763}:dest;
   const start=await page.evaluate(()=>({latitude:window.__qa.latitude,longitude:window.__qa.longitude}));
   const corner={latitude:start.latitude,longitude:target.longitude};
   data=routeFailure?{status:'UNAVAILABLE'}:{status:'READY',coordinates:[[start.latitude,start.longitude],[corner.latitude,corner.longitude],[target.latitude,target.longitude]],distanceMeters:distanceBetween(start,corner)+distanceBetween(corner,target),durationSeconds:100};
  }
  else{unexpected.push(path);return route.fulfill({status:404,json:{message:'Unexpected local fixture endpoint'}});}
  return route.fulfill({status:200,json:data});
 });
 const tr=(s,...v)=>translate(s,lang,...v),popup=page.locator('.permission-panel'),compass=page.locator('.dal-live-compass');
 // Yield between simulated seconds so React and intercepted async snapshots settle
 // before the next GPS/poll timer. One giant jump can batch many different fixes.
 const tick=async ms=>{for(let left=ms;left>0;left-=1000){await page.clock.runFor(Math.min(1000,left));await page.waitForTimeout(20);}};
 const arrow=()=>compass.locator('.dal-direction-arrow');
 const angle=async()=>Number((await arrow().getAttribute('style')).match(/rotate\(([-\d.e]+)deg/)[1]);
 const mode=name=>compass.locator('.compass-modes').getByRole('button',{name:tr(name),exact:true});
 async function shot(name){if(engine!=='chromium'||lang!=='en'||width===768)return;await compass.scrollIntoViewIfNeeded();await page.evaluate(()=>{const r=document.querySelector('.dal-live-compass').getBoundingClientRect();scrollBy(0,r.top-110);});await page.screenshot({path:join(shots,`${name}-${width}.png`)});}
 async function layout(label){
  for(const y of [0,99999,0]){
   await page.evaluate(y=>scrollTo(0,y),y);
   const v=await page.evaluate(()=>{const n=document.querySelector('.bottom-nav'),r=n.getBoundingClientRect();return{fixed:getComputedStyle(n).position==='fixed',anchored:Math.abs(r.bottom-innerHeight)<=1,overflow:document.documentElement.scrollWidth>innerWidth+1,count:n.querySelectorAll('button').length};});
   check(v.fixed&&v.anchored&&!v.overflow&&v.count===5,`${label}: fixed navigation and no overflow at scroll ${y}`);
  }
  const last=page.locator('.member-row button').last();await last.scrollIntoViewIfNeeded();
  const r=await last.boundingBox(),n=await page.locator('.bottom-nav').boundingBox();check(r.y+r.height<=n.y+1,`${label}: last member control reachable`);
 }
 await page.goto(base);await page.locator('.bottom-nav').waitFor();check(await page.evaluate(()=>window.__qa.watches===0&&window.__qa.nativePrompts===0),'no automatic native prompts');
 await page.locator('.bottom-nav').getByRole('button',{name:tr('المجموعات'),exact:true}).click();await page.locator('.group-card').first().click();
 await page.locator('.group-shortcuts').getByRole('button',{name:tr('الخريطة'),exact:true}).click();await popup.waitFor();
 check(await popup.getByRole('button',{name:tr('تفعيل الموقع'),exact:true}).count()===1,'unsupported query leaves initial activation available');
 await popup.getByRole('button',{name:tr('تفعيل الموقع'),exact:true}).click();await tick(100);
 const gpsRetry=popup.getByRole('button',{name:tr('إعادة المحاولة'),exact:true});check(await gpsRetry.isEnabled(),'GPS denial offers retry');
 await page.evaluate(()=>window.__qa.gpsDenied=false);await gpsRetry.click();await tick(100);await popup.waitFor({state:'hidden'});
 await page.locator('.member-row button').first().click();await tick(1200);await page.locator('.walking-route-status').waitFor();check(calls===1,'one shared walking request from map selection');
 const mapBefore=await page.locator('.leaflet-overlay-pane path[stroke="#2bba95"]').getAttribute('d');check(Boolean(mapBefore),'walking route drawn on map');
 await page.locator('.dal-navigation>.segmented').getByRole('button',{name:tr('البوصلة'),exact:true}).click();await popup.waitFor();
 await popup.getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true}).click();await tick(100);check(await popup.getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true}).isEnabled(),'denied sensor allows retry');
 await page.evaluate(()=>window.__qa.sensorDenied=false);await popup.getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true}).click();await tick(5500);
 check(await popup.getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true}).isEnabled(),'granted sensor without readings allows retry');
 await popup.getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true}).click();await page.evaluate(()=>window.__qa.sensorRead=true);await tick(200);await popup.waitFor({state:'hidden'});
 check(await page.evaluate(()=>window.__qa.nativePrompts===2),'retry after grant does not prompt again');check(calls===1,'map and compass share route instance');
 if(phase==='before'){
  check(await compass.locator('.compass-modes').count()===0,'main has direct Compass only');await shot('before-direct');await layout('main compass');
 }else{
  check(await mode('عبر الطريق').getAttribute('aria-pressed')==='true','valid route defaults to walking');
  check(Math.abs(await angle()-90)<1,'walking points east along first leg');await shot('walking-route');
  await mode('اتجاه مباشر').click();check(Math.abs(await angle()-90)>30,'direct bearing differs from route');await shot('direct');
  for(let i=0;i<4;i++){await mode('عبر الطريق').click();await mode('اتجاه مباشر').click();}check(calls===1,'mode switching creates zero routing requests');await mode('عبر الطريق').click();
  const initialDistance=await compass.locator('.distance-placeholder').innerText();
  await page.evaluate(()=>{window.__qa.latitude=24.71365;window.__qa.longitude=46.6755;window.__qa.send();});await tick(100);
  await page.waitForFunction(text=>document.querySelector('.dal-live-compass .distance-placeholder').innerText!==text,initialDistance);
  const progressedAngle=await angle();
  check(calls===1,'waypoint progress within movement threshold needs no extra route');check(Math.min(progressedAngle,360-progressedAngle)<1,`waypoint progressed onto northbound leg (${progressedAngle})`);await shot('waypoint-progress');
  const distance=await compass.locator('.distance-placeholder').innerText();await page.evaluate(()=>{window.__qa.longitude+=.000002;window.__qa.send();});await tick(100);check(await compass.locator('.distance-placeholder').innerText()===distance,'GPS jitter preserves progress');
  await layout('walking compass after dialogs');check(await page.locator('.dal-navigation').getAttribute('dir')===(lang==='ar'?'rtl':'ltr'),'localized direction');
  // A refresh pauses the arrow instead of guiding on old geometry.
  hold=true;await page.evaluate(()=>{window.__qa.latitude+=.0004;window.__qa.send();});await tick(11000);check(calls===2&&typeof releaseRoute==='function','existing movement refresh dispatched once');check(await arrow().count()===0,'no active arrow during recalculation');hold=false;releaseRoute();await page.locator('.walking-route-status').getByText(tr('المسار محدّث'),{exact:true}).waitFor();await tick(100);check(await arrow().count()===1,'fresh replacement restores guidance');
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});dispatchEvent(new Event('offline'));});await tick(100);await arrow().waitFor({state:'hidden'});check(await arrow().count()===0,'offline geometry not used for active guidance');check(await mode('عبر الطريق').getAttribute('aria-pressed')==='true','offline never silently switches modes');
  await mode('اتجاه مباشر').click();check(await mode('اتجاه مباشر').getAttribute('aria-pressed')==='true','direct remains an explicit alternative');
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:true});dispatchEvent(new Event('online'));});await tick(12000);
  // The baseline deliberately requires explicit GPS reactivation after an unknown
  // Permissions API result on reconnect. Never bypass that safe consent flow.
  if(await page.locator('.nav-gps-controls .filled').innerText()!==tr('إيقاف GPS على هذا الجهاز')){await page.locator('.nav-gps-controls .filled').click();await tick(200);}
  const stop=page.locator('.walking-card').getByRole('button',{name:tr('إيقاف التوجيه'),exact:true});if(await stop.isEnabled())await stop.click();
  routeFailure=true;await mode('عبر الطريق').click();await page.locator('.walking-card').getByRole('button',{name:tr('ابدأ التوجيه'),exact:true}).click();await tick(11000);
  check(await arrow().count()===0,'unavailable route has no arrow');await shot('unavailable');routeFailure=false;
  // Exact destination changes clear old progress immediately, including meeting points.
  await page.locator('.member-row button').last().click();check(await arrow().count()===0,'new member cannot reuse previous route');await tick(11000);check(await compass.locator('h2').innerText()==='QA Other Member','new member selected');
  await compass.getByRole('button',{name:tr('وجّهني إلى نقطة الالتقاء'),exact:true}).click();check(await compass.locator('h2').innerText()===meeting.name,'meeting target preserved');check(await arrow().count()===0,'meeting does not reuse member geometry');
  await page.locator('.walking-card').getByRole('button',{name:tr('ابدأ التوجيه'),exact:true}).click();await tick(11000);await page.locator('.walking-route-status').getByText(tr('المسار محدّث'),{exact:true}).waitFor();await arrow().waitFor();check(await arrow().count()===1,'walking guidance supports calculated meeting route');
  await page.locator('.member-row button').first().click();await tick(11000);stale=true;await tick(16000);await page.locator('.walking-card').getByText(tr('المسار يقود إلى آخر موقع معروف فقط؛ قد يكون العضو تحرك.'),{exact:true}).waitFor();await arrow().waitFor({state:'hidden'});check(await arrow().count()===0,'stale member pauses guidance');stale=false;revoked=true;await tick(16000);await page.waitForFunction(()=>document.querySelector('.dal-live-compass h2').innerText!=='QA Route Member');check(await arrow().count()===0,'sharing revocation clears guidance');check(await compass.locator('h2').innerText()!=='QA Route Member','revoked member target location removed');
  await layout('long compass after privacy update');
 }
 check(errors.length===0,'no page errors: '+errors.join('|'));check(unexpected.length===0,'no unexpected/production requests: '+unexpected.join('|'));
 results.push({engine,phase,language:lang,viewport:`${width}x${height}`,checks,walkingRequests:calls,browserNotices,passed:true,synthetic:true});console.log(`${phase} ${engine} ${width}x${height} ${lang}: ${checks} checks PASS`);await page.unrouteAll({behavior:'wait'});await ctx.close();
}}
finally{for(const ctx of browser.contexts())for(const page of ctx.pages())await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();await writeFile(join(output,`${phase}-${engine}.json`),JSON.stringify(results,null,2));}
console.log(JSON.stringify({engine,phase,contexts:results.length,checks:results.reduce((n,r)=>n+r.checks,0),passed:true,productionRequests:0}));
