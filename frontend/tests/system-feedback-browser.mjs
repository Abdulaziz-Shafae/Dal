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
const phase=process.argv[2]||'after',engine=process.argv[3]||'chromium',base=process.env.DAL_QA_BASE_URL||'http://localhost:5190';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output=process.env.DAL_QA_OUTPUT||join(tmpdir(),'dal-issue-10'),shots=fileURLToPath(new URL('../../docs/screenshots/',import.meta.url));
await mkdir(output,{recursive:true});await mkdir(shots,{recursive:true});
const sizes=phase==='before'?[[1280,720]]:[[390,844],[820,1180],[1280,720]];
const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true}));
const matrix=[];let fatal,contextIndex=0;
try {for(const [width,height]of sizes)for(const lang of(process.env.DAL_QA_LANGUAGES?.split(',')||(phase==='before'?['en']:['ar','en','fr']))){
  if(contextIndex++<Number(process.env.DAL_QA_START_INDEX||0))continue;
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});const page=await context.newPage();
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
    Object.defineProperty(navigator,'permissions',{value:{query:async()=>({state:'granted'})},configurable:true});
    Object.defineProperty(navigator,'geolocation',{value:{watchPosition(ok,fail){window.__gpsFail=fail;const send=()=>ok({coords:{latitude:24.7136,longitude:46.6753,accuracy:5},timestamp:Date.now()});setTimeout(send,10);return setInterval(send,1000);},clearWatch(id){clearInterval(id);}},configurable:true});
    window.__sensorCalls=0; window.__setSensor=mode=>{window.__sensorMode=mode; window.DeviceOrientationEvent=mode==='unsupported'?undefined:class{}; if(window.DeviceOrientationEvent)window.DeviceOrientationEvent.requestPermission=()=>{window.__sensorCalls++;return mode==='pending'?new Promise(resolve=>window.__resolveSensor=resolve):Promise.resolve(mode==='denied'?'denied':'granted');};}; window.__setSensor('unsupported');
    setInterval(()=>{if(window.__sensorMode==='ready')window.dispatchEvent(Object.assign(new Event('deviceorientationabsolute'),{absolute:true,alpha:0}));},250);
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
  async function check(state,selector,{shot=false}={}){
    const node=page.locator(selector).first();await node.waitFor();await node.scrollIntoViewIfNeeded();
    const metrics=await node.evaluate(el=>{
      const r=el.getBoundingClientRect(),nav=document.querySelector('.bottom-nav')?.getBoundingClientRect();
      return {role:el.getAttribute('role'),text:el.textContent.trim(),direction:document.documentElement.dir,
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        clipped:r.left < -1||r.right>innerWidth+1,
        bottomClear:!!el.closest('[role=dialog]')||!nav||r.bottom<=nav.top+1};
    });
    matrix.push({engine,language:lang,viewport:`${width}x${height}`,state,...metrics});
    assert.equal(metrics.direction,lang==='ar'?'rtl':'ltr');assert.ok(!metrics.overflow&&!metrics.clipped,JSON.stringify(matrix.at(-1)));
    if(phase==='after'&&lang!=='ar')assert.ok(!/[\u0600-\u06ff]/.test(metrics.text),`${state}: untranslated system text`);
    if(shot&&engine==='chromium'&&(phase==='before'||(lang==='en'&&width===1280)))await page.screenshot({path:join(shots,`issue-10-${phase}-${state}.png`)});
    if(shot&&phase==='after'&&engine==='chromium'&&((lang==='ar'&&width===390)||(lang==='fr'&&width===820))&&['unsupported-permission','sensor-denied','sensor-no-reading'].includes(state))await page.screenshot({path:join(shots,`issue-10-after-${state}-${lang}-${width}x${height}.png`)});
  }
  await page.goto(base);await page.locator('.bottom-nav').waitFor();
  await go('groups');await page.locator('.group-card').first().click();await page.locator('.group-detail').waitFor();
  await page.getByRole('button',{name:tr('إغلاق المجموعة'),exact:true}).click();await check('confirmation','.confirm-panel',{shot:true});
  await page.keyboard.press('Escape');assert.equal(await page.locator('.confirm-panel').count(),0);
  await go('compass');await page.locator('.permission-panel').waitFor();
  if(phase==='after')assert.equal(await page.locator('.permission-panel').getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true}).count(),0);
  await check('unsupported-permission','.permission-panel',{shot:true});await closeDialog();
  await check('unsupported-compass','.compass-sensor-status',{shot:true});
  if(phase==='after')assert.equal(await page.locator('.compass-permission').count(),0);
  assert.equal(await page.evaluate(()=>window.__sensorCalls),0);
  await page.evaluate(()=>window.__setSensor('denied'));await go('map');await closeDialog();await go('compass');
  await page.locator('.permission-panel').getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true}).click();
  await page.locator('.permission-panel [role=alert]').waitFor();await check('sensor-denied','.permission-panel',{shot:true});
  if(phase==='after'){await page.keyboard.press('Escape');assert.equal(await page.locator('.permission-panel').count(),0);}else await closeDialog();
  await page.evaluate(()=>window.__setSensor('pending'));await page.locator('.compass-permission').click();
  assert.equal(await page.evaluate(()=>window.__sensorCalls),2);await check('sensor-pending','.compass-sensor-status');
  assert.ok(await page.locator('.compass-permission').isDisabled());
  await page.evaluate(()=>{window.__resolveSensor('granted');window.__sensorMode='silent';});
  await page.waitForTimeout(5300);await check('sensor-no-reading','.compass-sensor-status',{shot:true});
  assert.equal(await page.evaluate(()=>window.__sensorCalls),2);
  await page.evaluate(()=>window.__sensorMode='ready');await page.locator('.has-heading').waitFor();
  assert.equal(await page.locator('.compass-sensor-status').count(),0);await check('sensor-ready-gps-missing','.dal-live-compass');
  await go('map');const permission=page.locator('.permission-panel');
  await permission.getByRole('button',{name:tr('تفعيل الموقع'),exact:true}).click();await permission.waitFor({state:'hidden'});
  await page.locator('.has-location-consent').waitFor();await page.locator('.member-row button').first().click();await page.locator('.walking-route-status').waitFor();
  await check('walking-ready','.walking-route-status');
  if(phase==='after'){
    await page.evaluate(()=>window.__setSensor('unsupported'));await go('compass');await closeDialog();
    await check('unsupported-with-gps','.compass-sensor-status');assert.equal(await page.locator('.dal-direction-arrow').count(),1);
    assert.equal(await page.locator('.compass-permission').count(),0);
    await page.evaluate(()=>window.__setSensor('silent'));await page.locator('.compass-permission').click();await page.evaluate(()=>window.__sensorMode='ready');await page.locator('.has-heading').waitFor();
    assert.equal(await page.evaluate(()=>window.__sensorCalls),2); // Grant reused; no additional native prompt.
    await page.evaluate(()=>window.__gpsFail({code:1}));await page.locator('.nav-gps-controls [role=alert]').waitFor();
    await check('gps-denied-with-heading','.nav-gps-controls [role=alert]');assert.equal(await page.locator('.has-heading').count(),1);
    await page.locator('.nav-gps-controls').getByRole('button',{name:tr('تفعيل الملاحة'),exact:true}).click();
    await page.locator('.has-location-consent').waitFor();await go('map');await closeDialog();
    await page.locator('.member-row button').first().click();await page.locator('.walking-route-status').waitFor();
  }
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});window.dispatchEvent(new Event('offline'));});
  await page.locator('.walking-route-status.outdated').waitFor();await check('offline-walking','.walking-route-status',{shot:true});
  assert.ok((await page.locator('.walking-route-status').textContent()).includes(tr('المسافة والمدة تخصان آخر حساب، وليستا تقدير وصول مباشرًا.')));
  await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'));});
  await page.locator('.nav-connection.connected').waitFor();await go('compass');await closeDialog();await page.locator('.has-heading').waitFor();
  await page.getByRole('button',{name:tr('وجّهني لأقرب عضو'),exact:true}).click();await check('nearest-success','.nearest-member-feedback');
  assert.ok((await page.locator('.nearest-member-feedback').textContent()).includes('QA Member'));
  await go('settings');await page.getByRole('button',{name:tr('حفظ الحساب'),exact:true}).click();await page.locator('.toast').waitFor();await check('success','.toast',{shot:true});
  assert.ok((await page.locator('.toast').textContent()).includes(tr('تم تحديث حسابك')));
  if(phase==='after'){await page.getByRole('button',{name:tr('إغلاق الرسالة'),exact:true}).click();assert.equal(await page.locator('.toast').count(),0);}
  await page.getByRole('button',{name:tr('إيقاف المشاركة في الكل'),exact:true}).click();await check('privacy-confirmation','.confirm-panel');await closeDialog();
  if(phase==='after'){
    sharing.isPaused=true;sharing.sharingEnabled=true;await go('groups');await go('settings');
    await page.getByRole('button',{name:tr('استئناف المشاركة في الكل'),exact:true}).waitFor();
    assert.ok((await page.locator('.subpanel').textContent()).includes(tr('المشاركة متوقفة')));await check('sharing-paused','.subpanel>p');
    sharing.isPaused=false;sharing.sharingMode='SCHEDULED';sharing.startTime=new Date(Date.now()+3600000).toISOString();sharing.endTime=new Date(Date.now()+7200000).toISOString();
    await go('groups');await go('settings');assert.ok((await page.locator('.subpanel>p').textContent()).includes(tr('المشاركة متوقفة')));await check('sharing-outside-schedule','.subpanel>p');
    sharing.sharingMode='ALWAYS';await go('groups');await go('settings');await check('sharing-allowed-not-transmitting','.subpanel>p');
    assert.ok((await page.locator('.subpanel>p').textContent()).includes(tr('المشاركة مسموحة وفق إعداداتك؛ إرسال الموقع يتطلب GPS واتصالًا.')));
  }
  for(const mode of ['loading','error','empty']){
    groupsMode=mode;await go('groups');
    await page.getByText(tr(mode==='empty'?'ما عندك مجموعات حتى الآن':mode==='error'?'تعذر تحميل المجموعات':'جارٍ تحميل مجموعاتك…'),{exact:true}).waitFor();
    await check(mode,mode==='error'?'.error-banner':mode==='empty'?'.empty':'.panel [role=status]',{shot:mode!=='empty'});
    if(mode==='error'){assert.ok(!(await page.locator('.error-banner').textContent()).includes('Synthetic'));await page.getByRole('button',{name:tr('إغلاق الخطأ'),exact:true}).click();assert.equal(await page.locator('.error-banner').count(),0);}
    if(mode==='loading'){groupsMode='ready';releaseGroups();await page.locator('.group-card').first().waitFor();}
    await go('settings');
  }
  groupsMode='ready';await go('groups');await page.locator('.group-card').first().waitFor();await check('network-recovered','.panel');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await context.close();console.log(`${phase} ${engine} ${width}x${height} ${lang}: ${matrix.length} feedback rows`);
}}catch(error){fatal=error;}finally{await browser.close();await writeFile(join(output,`${phase}-${engine}.json`),JSON.stringify({phase,engine,matrix,error:fatal?.message||null},null,2));}
if(fatal)throw fatal;
