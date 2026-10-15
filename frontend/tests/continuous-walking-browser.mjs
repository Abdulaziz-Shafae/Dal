// Local-only browser QA. API/ORS responses and GPS are synthetic; OSM tiles are display-only.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {translate}=await import('../src/i18n.js');
const {chromium,webkit}=require(process.env.DAL_QA_MODULES ? join(process.env.DAL_QA_MODULES,'playwright') : 'playwright');
const phase=process.argv[2]||'after',engine=process.argv[3]||'chromium';
if(!['before','after'].includes(phase)||!['chromium','webkit'].includes(engine))throw new Error('Expected before/after and chromium/webkit');
const root=process.env.DAL_QA_OUTPUT || join(tmpdir(),'dal-issue-08');
const base=process.env.DAL_QA_BASE_URL || 'http://localhost:5179';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Local synthetic QA only');
const screenshots=fileURLToPath(new URL('../../docs/screenshots/',import.meta.url));
await mkdir(join(root,phase),{recursive:true});
const browser=await (engine==='webkit'?webkit.launch({headless:true}):chromium.launch({...(process.env.DAL_QA_CHROME?{executablePath:process.env.DAL_QA_CHROME}:{channel:'chrome'}),headless:true}));
const results=[];
for(const [width,height] of [[390,844],[1280,720]]) for(let lang of (phase==='before'?['en']:['ar','en','fr'])) {
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'ar-SA'});
  const page=await ctx.newPage();const errors=[],unexpected=[],requests=[];let disconnected=false,walkingCalls=0,releaseWalking,hold=false;
  const user={id:1,name:'QA User',email:'ui@example.com'};
  const group={id:10,name:'QA Friends',joinCode:'QA123',memberCount:3,myRole:'OWNER',status:'ACTIVE',joinMode:'DIRECT'};
  const meeting={id:20,name:'QA Gate',latitude:24.7136,longitude:46.6763};
  const members=[{id:1,userId:1,name:user.name,role:'OWNER'},{id:2,userId:2,name:'QA Far Member',role:'MEMBER'},{id:3,userId:3,name:'QA Nearest Member',role:'MEMBER'}];
  const membership={sharingEnabled:true,isPaused:false};
  const sharing={sharingEnabled:true,isPaused:false,sharingMode:'ALWAYS',startTime:null,endTime:null,updateIntervalSeconds:15};
  const notifications=[];
  const rows=members.map((m,i)=>({...m,latitude:24.7136+(i===1?.001:0),longitude:46.6753+(i===2?.0003:0),sharingEnabled:true,accuracy:5,recordedAt:new Date().toISOString()}));
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===new URL(base).origin&&!url.pathname.startsWith('/api/')) return route.continue();
    if(url.hostname==='tile.openstreetmap.org')return disconnected?route.abort('internetdisconnected'):route.continue();
    if(url.origin!==new URL(base).origin) {unexpected.push(url.hostname);return route.abort();}
    if(disconnected)return route.abort();const path=url.pathname.replace('/api/v1','');requests.push({path,method:req.method()});let data;
    if(path==='/notification/my')return route.fulfill({status:200,json:{content:notifications}});
    if(path==='/notification/unread-count') return route.fulfill({status:200,json:{count:notifications.filter(n=>!n.readAt).length}});
    if(path==='/security/csrf') data={headerName:'X-CSRF-TOKEN',token:'synthetic'};
    else if(path==='/user/profile') data=user;
    else if(path==='/group/my') data=[group,{...group,id:11,name:'QA Family Group',joinCode:'QA456',memberCount:12,status:'PAUSED'}];
    else if(path==='/group/10') data=group;
    else if(path==='/join-request/my'||path.startsWith('/join-request/group/')) data=[];
    else if(path==='/group-member/group/10') data=members;
    else if(path.startsWith('/sharing/group/')) data=membership;
    else if(path.startsWith('/sharing')) data=sharing;
    else if(path==='/meeting-point/group/10') {if(req.method()==='PUT')Object.assign(meeting,req.postDataJSON());data=meeting;}
    else if(path==='/location/group/10') {const time=await page.evaluate(()=>Date.now());for(const row of rows){row.recordedAt=new Date(time).toISOString();row.visibleUntil=null;}data=rows;}
    else if(path==='/location/my') data={userId:1,sharingEnabled:false,latitude:null,longitude:null};
    else if(path==='/location/update') data={...rows[0],...req.postDataJSON()};
    else if(path==='/notification/unread-count') data={count:3};
    else if(path.includes('/walking')) {walkingCalls++;if(hold)await new Promise(resolve=>releaseWalking=resolve);data={status:'READY',coordinates:[[24.7136+(walkingCalls>1?.0003:0),46.6753],[24.7131,46.6753],[24.7131,46.6756],[24.7136,46.6756]],distanceMeters:220.4+walkingCalls,durationSeconds:158.7+walkingCalls};}
    else if(path.startsWith('/group-message/group/')) data=path.includes('unread-count')?{count:0}:req.method()==='GET'?{content:[{id:1,senderId:2,senderName:'QA Member',content:'Synthetic group message',createdAt:new Date().toISOString()}],last:true}:{id:2};
    else if(path.startsWith('/message/group/')) data=req.method()==='GET'?{content:[],last:true}:{id:2};
    else if(path.startsWith('/message/')||path.startsWith('/reunion/')) data={};
    else {unexpected.push(path);return route.fulfill({status:404,json:{message:'Unexpected local fixture endpoint'}});}
    return route.fulfill({status:200,json:data});
  });
  await page.clock.install({time:new Date('2026-10-14T15:00:00Z')});
  await page.addInitScript(language=>{
    localStorage.setItem('dal-language',language);window.__latitude=24.7136;
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'granted'})}});
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(ok){window.__gpsSuccess=()=>ok({coords:{latitude:window.__latitude,longitude:46.6753,accuracy:5},timestamp:Date.now()});setTimeout(window.__gpsSuccess,80);return setInterval(window.__gpsSuccess,1000);},clearWatch(id){clearInterval(id);}}});
    window.DeviceOrientationEvent=class {};window.DeviceOrientationEvent.requestPermission=async()=> 'granted';
    setInterval(()=>window.dispatchEvent(Object.assign(new Event('deviceorientationabsolute'),{absolute:true,alpha:0})),250);
  },lang);
  const tr=(key,...values)=>translate(key,lang,...values),popup=page.locator('.permission-panel');
  const paths=()=>page.locator('.leaflet-overlay-pane path[stroke="#2bba95"]');
  async function shot(name){if(!process.argv.includes('--screenshots'))return;await mkdir(screenshots,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(screenshots,name+'.png'),fullPage:true});}
  await page.goto(base);await page.locator('.bottom-nav').getByRole('button',{name:tr('المجموعات'),exact:true}).click();await page.locator('.group-card').first().click();await page.locator('.group-shortcuts').getByRole('button',{name:tr('الخريطة'),exact:true}).click();await popup.waitFor();await popup.getByRole('button',{name:tr('تفعيل الموقع'),exact:true}).click();await page.clock.runFor(200);
  await page.locator('.member-row button').last().click();await page.clock.runFor(1200);await page.locator('.walking-card').getByText(/221/).waitFor();await paths().waitFor();
  await page.locator('.walking-card').getByRole('button',{name:tr('ابدأ التوجيه'),exact:true}).click();
  await page.clock.runFor(10000);hold=true;await page.evaluate(()=>{window.__latitude+=.0003;window.__gpsSuccess();});await page.clock.runFor(1500);
  await page.locator('.walking-card').getByText(tr(phase==='before'?'جارٍ حساب طريق المشي…':'جارٍ تحديث المسار...'),{exact:true}).waitFor();
  // The refresh label appears at the threshold, before the debounced dispatch.
  for(let n=0;walkingCalls<2&&n<4;n++)await page.clock.runFor(1000);
  assert.equal(walkingCalls,2);assert.equal(typeof releaseWalking,'function');
  if(phase==='before'){assert.equal(await paths().count(),0);if(width===390&&engine==='chromium')await shot('issue-08-before-route-refresh');results.push({engine,width,height,lang,pass:true,beforeDisappearanceConfirmed:true});}
  else {
    assert.equal(await paths().count(),1);await page.locator('.walking-card').getByText(tr('جارٍ تحديث المسار...'),{exact:true}).waitFor();if(width===390&&lang==='en'&&engine==='chromium')await shot('issue-08-after-route-refresh');
    hold=false;releaseWalking();await page.locator('.walking-card').getByText(/222/).waitFor();
    const mapIdentity=await page.locator('.leaflet-container').evaluate(el=>{el.dataset.qaIdentity='retained';return el.dataset.qaIdentity;});
    disconnected=true;await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});dispatchEvent(new Event('offline'));});await page.clock.runFor(1200);
    await page.locator('.walking-card').getByText(tr('الاتصال منقطع. هذا آخر مسار محسوب وقد لا يعكس موقعك الحالي.'),{exact:true}).waitFor();assert.equal(await paths().count(),1);assert.ok(await paths().getAttribute('stroke-dasharray'));assert.equal(await page.locator('.leaflet-container').getAttribute('data-qa-identity'),mapIdentity);assert.equal(walkingCalls,2);if(width===390&&lang==='en'&&engine==='chromium')await shot('issue-08-after-offline-route');
    await page.locator('.leaflet-tile').first().evaluate(image=>image.dispatchEvent(new Event('error')));await page.locator('.nav-offline-list').waitFor();assert.equal(await page.locator('.leaflet-container').isVisible(),false);assert.equal(await page.locator('.walking-route-status').count(),1);
    await page.clock.runFor(10000);disconnected=false;await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:true});dispatchEvent(new Event('online'));});await page.clock.runFor(1500);await page.clock.runFor(1200);await page.locator('.dal-live-map').getByRole('button',{name:tr('إعادة المحاولة'),exact:true}).click();await page.clock.runFor(200);await page.locator('.walking-card').getByText(/223/).waitFor();assert.equal(walkingCalls,3);assert.equal(await paths().count(),1);assert.equal(await page.locator('.leaflet-container').getAttribute('data-qa-identity'),mapIdentity);if(width===390&&lang==='en'&&engine==='chromium')await shot('issue-08-after-reconnected-route');
    await page.locator('.walking-card').getByRole('button',{name:tr('إيقاف التوجيه'),exact:true}).click();assert.equal(await paths().count(),0);await page.clock.runFor(1200);assert.equal(walkingCalls,3);
    await page.locator('.member-row button').last().click();await page.clock.runFor(11000);await page.locator('.walking-card').getByText(/224/).waitFor();
    rows[2].sharingEnabled=false;await page.clock.runFor(11000);assert.equal(await paths().count(),0);await page.getByText(tr('انتهت صلاحية الموقع، توقف التوجيه.'),{exact:true}).waitFor();
    await page.locator('.segmented').getByRole('button',{name:tr('البوصلة'),exact:true}).click();
    await popup.getByRole('button',{name:tr('تفعيل حساس البوصلة'),exact:true}).click();await page.clock.runFor(500);
    await page.locator('.dal-live-compass').getByRole('button',{name:tr('وجّهني لأقرب عضو'),exact:true}).click();
    await page.locator('.dal-live-compass h2').getByText('QA Far Member',{exact:true}).waitFor();assert.equal(walkingCalls,4);
    await page.locator('.dal-live-compass').getByRole('button',{name:tr('وجّهني إلى نقطة الالتقاء'),exact:true}).click();
    await page.locator('.dal-live-compass h2').getByText('QA Gate',{exact:true}).waitFor();assert.equal(walkingCalls,4);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.equal(await page.locator('.dal-navigation').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
    results.push({engine,width,height,lang,pass:true,walkingCalls});
  }
  assert.deepEqual(unexpected,[]);assert.equal(errors.filter(e=>!e.includes('net::ERR_FAILED')&&!e.includes('interactive-widget')&&!e.includes('Failed to load resource')).length,0,errors.join(' | '));await ctx.close();
}
await browser.close();await writeFile(join(root,phase+'-'+engine+'.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({engine,cases:results.length,passed:results.length,productionRequests:0}));
