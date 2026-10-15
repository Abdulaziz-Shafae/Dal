// Local-only feedback audit. All account, sensor, GPS and API data is synthetic.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { translate } from '../src/i18n.js';
import { texts } from '../src/translations.js';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.DAL_QA_MODULES?join(process.env.DAL_QA_MODULES,'playwright'):'playwright');
const phase=process.argv[2]||'after',engine=process.argv[3]||'chromium',base=process.env.DAL_QA_BASE_URL||'http://localhost:5193';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output=process.env.DAL_QA_OUTPUT||join(tmpdir(),'dal-ios-retry'),shots=fileURLToPath(new URL('../../docs/screenshots/',import.meta.url));
await mkdir(output,{recursive:true});await mkdir(shots,{recursive:true});
const sizes=process.argv.includes('--quick')?[[390,844]]:[[390,844],[430,932],[844,390],[1280,720]];
const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true}));
const matrix=[];let fatal,contextIndex=0;
try {for(const [width,height]of sizes)for(const lang of(process.env.DAL_QA_LANGUAGES?.split(',')||['ar','en','fr'])){
  if(contextIndex++<Number(process.env.DAL_QA_START_INDEX||0))continue;
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<1000,hasTouch:width<1000});const page=await context.newPage();
  const tr=(key,...values)=>translate(key,lang,...values),t=texts[lang],errors=[],unexpected=[];
  let authenticated=true,groupsMode='ready',notificationsMode='ready',chatMode='ready',role='OWNER',meetingAvailable=true,releaseGroups,releaseChat,releaseNotifications;
  const waiting={groups:[],chat:[],notifications:[]};
  const hold=family=>new Promise(resolve=>waiting[family].push(resolve));
  const release=family=>waiting[family].splice(0).forEach(resolve=>resolve());
  const user={id:1,name:'QA User',email:'layout@example.com'},group={id:10,name:'QA Friends',joinCode:'QA123',memberCount:3,myRole:'OWNER',status:'ACTIVE',joinMode:'APPROVAL'};
  const members=[{id:1,userId:1,name:user.name,role:'OWNER'},{id:2,userId:2,name:'QA Member',role:'MEMBER'},{id:3,userId:3,name:'QA Other Member',role:'ADMIN'}];
  const meeting={id:20,name:'QA Gate',latitude:24.7136,longitude:46.6763},sharing={sharingEnabled:true,isPaused:false,sharingMode:'ALWAYS',updateIntervalSeconds:15};
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(language=>{
    localStorage.setItem('dal-language',language);
    const qa=window.__qa={watches:new Map(),calls:0,maximum:0,queryMode:'unsupported',gpsMode:'silent',sensorDecision:'granted',sensorMode:'silent',prompts:0,heading:90,gestures:[]};
    const permission={state:'prompt',onchange:null};
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>{if(qa.queryMode==='unsupported')throw new TypeError('Synthetic unsupported permission query');permission.state=qa.queryMode;return permission;}}});
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(ok,fail){const id=++qa.calls;qa.watches.set(id,{ok,fail});qa.maximum=Math.max(qa.maximum,qa.watches.size);return id;},clearWatch(id){qa.watches.delete(id);}}});
    qa.fix=()=>{for(const watch of [...qa.watches.values()])watch.ok({coords:{latitude:24.7136,longitude:46.6753,accuracy:5},timestamp:Date.now()});};
    qa.fail=code=>{for(const watch of [...qa.watches.values()])watch.fail({code});};
    window.DeviceOrientationEvent=class{};
    window.DeviceOrientationEvent.requestPermission=()=>{qa.prompts++;qa.gestures.push(navigator.userActivation?.isActive??true);return qa.sensorDecision==='pending'?new Promise(resolve=>qa.resolveSensor=resolve):Promise.resolve(qa.sensorDecision);};
    setInterval(()=>{if(qa.gpsMode==='ready')qa.fix();if(qa.sensorMode==='ready')window.dispatchEvent(Object.assign(new Event('deviceorientation'),{webkitCompassHeading:qa.heading,webkitCompassAccuracy:5}));},100);
  },lang);
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='tile.openstreetmap.org')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tOAAAAAASUVORK5CYII=','base64')});
    if(url.origin!==new URL(base).origin){unexpected.push(url.hostname);return route.abort();}
    if(!url.pathname.startsWith('/api/'))return route.continue();
    const path=url.pathname.replace('/api/v1','');let data;
    if(path==='/security/csrf')data={token:'synthetic',headerName:'X-CSRF-TOKEN'};
    else if(path==='/user/profile')data=authenticated?user:null;
    else if(path==='/group/my'){
      if(groupsMode==='loading'){releaseGroups=()=>release('groups');await hold('groups');}
      if(groupsMode==='error')return route.fulfill({status:503,json:{message:'Synthetic service failure'}});
      data=groupsMode==='empty'?[]:[{...group,myRole:role},{...group,id:11,name:'QA Family',status:'PAUSED'}];
    }
    else if(path==='/group/10')data={...group,myRole:role};
    else if(path==='/group-member/group/10')data=members;
    else if(path==='/join-request/my')data=[{id:40,status:'PENDING',groupName:'QA Pending Group'}];
    else if(path.startsWith('/join-request/group/'))data=[{id:41,userName:'QA Applicant'}];
    else if(path.startsWith('/sharing/group/'))data={sharingEnabled:true,isPaused:false};
    else if(path==='/sharing')data=sharing;
    else if(path==='/sharing/pause'){sharing.isPaused=true;sharing.sharingEnabled=false;data=sharing;}
    else if(path==='/sharing/resume'){sharing.isPaused=false;sharing.sharingEnabled=true;data=sharing;}
    else if(path==='/meeting-point/group/10')data=meetingAvailable?meeting:null;
    else if(path==='/location/group/10')data=members.map((m,i)=>({...m,latitude:24.7136+i*.0003,longitude:46.6753,accuracy:5,sharingEnabled:true,visibleUntil:null,recordedAt:new Date().toISOString()}));
    else if(path==='/location/update')data={...req.postDataJSON(),userId:1,sharingEnabled:true,visibleUntil:null};
    else if(path==='/notification/unread-count')data={count:3};
    else if(path==='/notification/my'){
      if(notificationsMode==='loading'){releaseNotifications=()=>release('notifications');await hold('notifications');}
      if(notificationsMode==='error')return route.fulfill({status:503,json:{message:'Synthetic service failure'}});
      data={content:notificationsMode==='empty'?[]:[{id:30,type:'MESSAGE',groupId:10,senderId:2,senderName:'QA Member',content:'You have a new group message',createdAt:new Date().toISOString(),readAt:null}]};
    }
    else if(path.startsWith('/group-message/')||path.startsWith('/message/')){
      if(path.includes('unread-count'))data={count:0};
      else if(req.method()!=='GET')data={};
      else if(chatMode==='loading'){releaseChat=()=>release('chat');await hold('chat');data={content:[],last:true};}
      else if(chatMode==='error')return route.fulfill({status:503,json:{message:'Synthetic service failure'}});
      else data={content:chatMode==='empty'?[]:Array.from({length:25},(_,i)=>({id:i+1,senderId:i%2?1:2,senderName:'QA Member',content:'Synthetic layout message '+i,createdAt:new Date().toISOString(),readAt:i%2?new Date().toISOString():null})),last:true};
    }
    else if(path.endsWith('/walking'))data={status:'READY',coordinates:[[24.7136,46.6753],[24.7139,46.6753]],distanceMeters:100,durationSeconds:80};
    else if(path.endsWith('/reunion-assistance'))data={source:'RULES',locationStatus:'RECENT',recommendation:'استخدم طريق المشي المحسوب إن توفر، أو البوصلة باتجاه الوجهة مع مراعاة حدود الخرائط.',reason:'Synthetic explanation '.repeat(18),warning:'دقة GPS منخفضة أو غير معروفة؛ المسافات والاتجاه تقريبيان.',walkingDistanceMeters:100,action:'FOLLOW_ROUTE'};
    else if(path.endsWith('/meeting-suggestions'))data={source:'RULES',ranking:[{index:0,name:'QA Candidate',latitude:meeting.latitude,longitude:meeting.longitude,maximumDistanceMeters:100}],includedMembers:3,excludedMembers:0,reason:'Synthetic explanation '.repeat(18),warning:'دقة GPS منخفضة أو غير معروفة؛ المسافات والاتجاه تقريبيان.'};
    else {unexpected.push(path);return route.fulfill({status:404,json:{message:'Unexpected synthetic endpoint'}});}
    return route.fulfill({status:200,json:data});
  });
  const menu=page.locator('.menu-panel');
  async function closeDialog(){if(await page.locator('.permission-panel').count())await page.locator('.permission-panel').getByRole('button',{name:tr('ليس الآن'),exact:true}).click();else if(await page.locator('[role=dialog]').count())await page.keyboard.press('Escape');}
  async function go(view){
    await closeDialog();const labels={home:t.home,groups:t.groups,map:t.map,compass:t.compass,meeting:t.meeting,chat:t.chat,settings:t.account};
    const bottom=page.locator('.bottom-nav');const button=bottom.getByRole('button',{name:view==='settings'?tr('حسابي'):labels[view],exact:true});
    if(await button.count()&&await button.isVisible())await button.click();
    else {await page.getByRole('button',{name:tr('القائمة'),exact:true}).click();await menu.getByRole('button',{name:labels[view],exact:true}).click();}
  }
  async function check(state,selector='.dal-navigation'){
    const node=page.locator(selector).first();await node.waitFor();
    const row=await page.evaluate(({state,selector})=>{
      const nav=document.querySelector('.bottom-nav'),r=nav.getBoundingClientRect(),viewport=window.visualViewport;
      const ancestors=[];for(let e=nav.parentElement;e;e=e.parentElement){const c=getComputedStyle(e);ancestors.push({tag:e.tagName,className:e.className,transform:c.transform,filter:c.filter,perspective:c.perspective,contain:c.contain,overflow:c.overflow});}
      return{state,scrollY,viewportHeight:viewport?.height??innerHeight,viewportTop:viewport?.offsetTop??0,innerHeight,bottom:r.bottom,top:r.top,height:r.height,position:getComputedStyle(nav).position,
        tabs:nav.querySelectorAll('button').length,overflow:document.documentElement.scrollWidth>innerWidth+1,direction:document.documentElement.dir,ancestors,
        message:document.querySelector(selector)?.textContent?.trim(),dialWidth:document.querySelector('.dal-compass-dial')?.getBoundingClientRect().width??null};
    },{state,selector});
    matrix.push({engine,language:lang,viewport:`${width}x${height}`,...row});
    assert.equal(row.position,'fixed');assert.equal(row.tabs,5);assert.equal(row.overflow,false);assert.ok(Math.abs(row.bottom-(row.viewportTop+row.viewportHeight))<=1,JSON.stringify(row));
    assert.equal(row.direction,lang==='ar'?'rtl':'ltr');
    assert.ok(row.ancestors.every(a=>a.transform==='none'&&a.filter==='none'&&a.perspective==='none'&&a.contain==='none'));
    if(engine==='chromium'&&lang==='en'&&width===390&&['gps-retry','compass-reading-timeout','compass-scroll-down','compass-scroll-up','map-scroll-down','map-scroll-up'].includes(state)&&(phase==='after'||state.includes('scroll')))await page.screenshot({path:join(shots,`ios-retry-${phase}-${state}.png`)});
  }
  async function scrollCheck(view){
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await check(`${view}-top`);
    for(const direction of [1,1,1,-1,-1,-1]){if(engine==='webkit'&&width<1000)await page.evaluate(y=>scrollBy({top:y,behavior:'instant'}),direction*320);else await page.mouse.wheel(0,direction*320);await page.waitForTimeout(80);await check(`${view}-scroll-${direction>0?'down':'up'}`);}
    await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await check(`${view}-bottom`);
    const clear=await page.locator('.member-picker button').last().evaluate(el=>{el.scrollIntoView({block:'center'});return new Promise(resolve=>requestAnimationFrame(()=>resolve(el.getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top+1)));});assert.equal(clear,true);
    for(const h of [Math.max(320,height-160),height+80,height]){await page.setViewportSize({width,height:h});await check(`${view}-resize-${h}`);}
    await page.setViewportSize({width:height,height:width});await check(`${view}-rotated`);await page.setViewportSize({width,height});
    await page.locator('.app').evaluate(el=>el.style.setProperty('--bottom-nav-height','114px'));await check(`${view}-inset-contract`);
    assert.equal((await page.locator('.bottom-nav').boundingBox()).height,114);await page.locator('.app').evaluate(el=>el.style.removeProperty('--bottom-nav-height'));
  }
  await page.goto(base);await page.locator('.bottom-nav').waitFor();await go('groups');await page.locator('.group-card').first().click();await page.locator('.group-detail').waitFor();
  await go('compass');await page.locator('.permission-panel').waitFor();
  assert.equal(await page.evaluate(()=>window.__qa.calls),0);assert.equal(await page.evaluate(()=>window.__qa.prompts),0);
  assert.ok(!(await page.locator('.permission-panel').textContent()).includes(tr('إذن الموقع مرفوض. اسمح بالموقع من إعدادات المتصفح ثم أعد المحاولة.')));
  const location=page.locator('.permission-panel').getByRole('button',{name:tr('تفعيل الموقع'),exact:true});
  await location.click();await page.locator('.permission-panel').getByRole('button',{name:tr('جارٍ تحديد موقعك…'),exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__qa.calls),1);assert.equal(await page.evaluate(()=>window.__qa.prompts),0);
  await page.evaluate(()=>window.__qa.fail(1));const retry=page.locator('.permission-panel').getByRole('button',{name:tr('إعادة المحاولة'),exact:true});await retry.waitFor();assert.equal(await retry.isEnabled(),true);await check('gps-retry','.permission-panel');
  await retry.click();await page.getByRole('button',{name:tr('جارٍ تحديد موقعك…'),exact:true}).first().waitFor();
  await page.evaluate(()=>window.__qa.fail(3));await retry.waitFor();assert.equal(await retry.isEnabled(),true);
  await retry.click();await page.evaluate(()=>{window.__qa.gpsMode='ready';window.__qa.fix();});await retry.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.__qa.maximum),1);assert.equal(await page.evaluate(()=>window.__qa.prompts),0);
  const sensor=page.locator('.permission-panel').getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true});
  await page.evaluate(()=>window.__qa.sensorDecision='denied');await sensor.click();await page.locator('.permission-panel [role=alert]').waitFor();assert.equal(await sensor.isEnabled(),true);
  await page.evaluate(()=>window.__qa.sensorDecision='pending');await sensor.click();assert.equal(await sensor.isDisabled(),true);assert.equal(await page.evaluate(()=>window.__qa.prompts),2);
  await page.evaluate(()=>window.__qa.resolveSensor('granted'));await page.waitForTimeout(5200);assert.equal(await sensor.isEnabled(),true);
  await sensor.click();await page.waitForTimeout(5200);assert.equal(await sensor.isEnabled(),true);assert.equal(await page.evaluate(()=>window.__qa.prompts),2);
  await closeDialog();await check('compass-reading-timeout','.compass-sensor-status');
  await page.locator('.compass-permission').click();await page.evaluate(()=>window.__qa.sensorMode='ready');await page.locator('.has-heading').waitFor();
  await page.getByRole('button',{name:tr('وجّهني لأقرب عضو'),exact:true}).click();const old=await page.locator('.dal-direction-arrow').getAttribute('style');
  await page.evaluate(()=>window.__qa.heading=180);await page.waitForTimeout(160);assert.notEqual(await page.locator('.dal-direction-arrow').getAttribute('style'),old);
  await scrollCheck('compass');
  // Missing query support on foreground recovery stays idle until an explicit retry.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.__qa.watches.size===0);
  const before=await page.evaluate(()=>window.__qa.calls);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__qa.calls),before);
  const controls=page.locator('.nav-gps-controls');await controls.getByRole('button',{name:tr('تفعيل الموقع'),exact:true}).click();await page.locator('.has-location-consent').waitFor();
  assert.equal(await page.evaluate(()=>window.__qa.prompts),2);assert.equal(await page.evaluate(()=>window.__qa.maximum),1);
  await go('map');await closeDialog();await page.locator('.has-location-consent').waitFor();await scrollCheck('map');
  assert.deepEqual(await page.evaluate(()=>window.__qa.gestures),[true,true]);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  await context.close();console.log(`${phase} ${engine} ${width}x${height} ${lang}: ${matrix.length} checks`);
}}catch(error){fatal=error;}finally{await browser.close();await writeFile(join(output,`${phase}-${engine}.json`),JSON.stringify({phase,engine,matrix,error:fatal?.message||null},null,2));}
if(fatal)throw fatal;
