// Isolated, local-only responsive audit: all account/group/API data is synthetic.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { translate } from '../src/i18n.js';
import { texts } from '../src/translations.js';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.DAL_QA_MODULES?join(process.env.DAL_QA_MODULES,'playwright'):'playwright');
const phase=process.argv[2]||'after',engine=process.argv[3]||'chromium',base=process.env.DAL_QA_BASE_URL||'http://localhost:5189';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output=process.env.DAL_QA_OUTPUT||join(tmpdir(),'dal-issue-09'),shots=fileURLToPath(new URL('../../docs/screenshots/',import.meta.url));
await mkdir(output,{recursive:true});await mkdir(shots,{recursive:true});
const sizes=process.argv.includes('--quick')?[[820,1180],[1024,768]]:[[390,844],[768,1024],[820,1180],[834,1194],[1024,768],[1180,820],[1194,834],[1280,720],[1440,900]];
const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true}));
const matrix=[];let fatal,contextIndex=0;
try {for(const [width,height]of sizes)for(const lang of(process.env.DAL_QA_LANGUAGES?.split(',')||(process.argv.includes('--quick')?['en']:['ar','en','fr']))){
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
    Object.defineProperty(navigator,'geolocation',{value:{watchPosition(ok){const send=()=>ok({coords:{latitude:24.7136,longitude:46.6753,accuracy:5},timestamp:Date.now()});setTimeout(send,10);return setInterval(send,1000);},clearWatch(id){clearInterval(id);}},configurable:true});
    window.DeviceOrientationEvent=class{};window.DeviceOrientationEvent.requestPermission=async()=> 'granted';
    setInterval(()=>window.dispatchEvent(Object.assign(new Event('deviceorientationabsolute'),{absolute:true,alpha:0})),250);
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
  async function closeDialog(){if(await page.locator('[role=dialog]').count())await page.keyboard.press('Escape');}
  async function go(view){
    await closeDialog();const labels={home:t.home,groups:t.groups,map:t.map,compass:t.compass,meeting:t.meeting,chat:t.chat,settings:t.account};
    const bottom=page.locator('.bottom-nav');const button=bottom.getByRole('button',{name:view==='settings'?tr('حسابي'):labels[view],exact:true});
    if(await button.count()&&await button.isVisible())await button.click();
    else {await page.getByRole('button',{name:tr('القائمة'),exact:true}).click();await menu.getByRole('button',{name:labels[view],exact:true}).click();}
  }
  async function audit(state,selector,{center=true,shot=false}={}){
    const node=page.locator(selector).first();await node.waitFor();await page.evaluate(()=>scrollTo(0,0));
    const metrics=await node.evaluate((el,{center})=>{
      const r=el.getBoundingClientRect(),nav=document.querySelector('.bottom-nav'),nr=nav?.getBoundingClientRect(),shown=nav&&getComputedStyle(nav).display!=='none';
      const navItems=shown?[...nav.querySelectorAll('button')].map(b=>b.getBoundingClientRect()):[];
      const clippedControls=[...el.querySelectorAll('button,input,select,textarea')].filter(c=>c.getClientRects().length&&!c.closest('.member-row,.quick-replies')).filter(c=>{const cr=c.getBoundingClientRect();return cr.left<r.left-1||cr.right>r.right+1;}).length;
      const brand=document.querySelector('.workspace-nav .brand')?.getBoundingClientRect(),headerBrandOffset=brand?+Math.abs(brand.left+brand.width/2-innerWidth/2).toFixed(2):null;
      const buttonTextOverflow=[...el.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.closest('.member-row,.quick-replies')&&b.scrollWidth>b.clientWidth+1).length;
      return{left:+r.left.toFixed(2),right:+(innerWidth-r.right).toFixed(2),width:+r.width.toFixed(2),centerOffset:+Math.abs(r.left-(innerWidth-r.right)).toFixed(2),headerBrandOffset,buttonTextOverflow,renderHeight:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,clippedControls,centered:!center||Math.abs(r.left-(innerWidth-r.right))<=2,navigationVisible:Boolean(shown),navAnchored:!shown||Math.abs(nr.bottom-innerHeight)<=1,navItemsVisible:!shown||navItems.length===5&&navItems.every(r=>r.left>=-1&&r.right<=innerWidth+1&&r.top>=nr.top-1&&r.bottom<=nr.bottom+1)};
    },{center});
    const row={phase,engine,language:lang,viewport:`${width}x${height}`,state,...metrics};matrix.push(row);
    if(shot&&['home','groups','map','compass','chat-group','group-owner','footer'].includes(state)&&engine==='chromium'&&lang==='en'&&[820,1024].includes(width)){if(state==='footer')await node.scrollIntoViewIfNeeded();await page.screenshot({path:join(shots,`issue-09-${phase}-${state}-${width}x${height}.png`)});}
    if(shot&&state==='chat-group'&&engine==='chromium'&&lang==='fr'&&width===1024)await page.screenshot({path:join(shots,`issue-09-${phase}-${state}-fr-${width}x${height}.png`)});
    if(phase==='after'){
      assert.ok(!metrics.overflow&&!metrics.clippedControls&&!metrics.buttonTextOverflow&&metrics.centered&&metrics.navAnchored&&metrics.navItemsVisible&&(!metrics.headerBrandOffset||metrics.headerBrandOffset<=2),JSON.stringify(row));
      if(width>=761&&await node.evaluate(el=>el.matches('.dal-navigation--map,.dal-navigation--meeting')))assert.ok(metrics.width>=Math.min(1040,width-48)-1,JSON.stringify(row));
      if(await node.evaluate(el=>Boolean(el.closest('.workspace-main'))&&el.getAttribute('role')!=='dialog')){
        row.reachability=await node.evaluate(async el=>{
          const controls=[...el.querySelectorAll('button,input,select,textarea,summary')].filter(c=>c.getClientRects().length&&!c.disabled&&(!c.closest('details:not([open])')||c.tagName==='SUMMARY')&&(c.checkVisibility?.()??true));
          controls.sort((a,b)=>a.getBoundingClientRect().bottom-b.getBoundingClientRect().bottom);const last=controls.at(-1);if(!last)return true;
          last.scrollIntoView({block:'center',behavior:'instant'});await new Promise(requestAnimationFrame);const nav=document.querySelector('.bottom-nav');
          const bottom=last.getBoundingClientRect().bottom,limit=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().top:innerHeight;
          return{clear:bottom<=limit+1,bottom,limit,scrollY,bodyOverflow:document.body.style.overflow,tag:last.tagName};
        });
        row.lastControlClear=typeof row.reachability==='boolean'?row.reachability:row.reachability.clear;
        assert.equal(row.lastControlClear,true,JSON.stringify(row));
      }
    }
  }
  async function groupPage(){await go('groups');await page.locator('.group-card').first().click();await page.locator('.group-detail').waitFor();}
  await page.goto(base);await page.locator('.bottom-nav').waitFor();await audit('home','.hero-inner',{shot:true});
  for(const [state,selector]of [['tools','.tools-section>.container'],['landing-compass','.compass-section>.container'],['landing-meeting','.meeting-section>.container'],['cta','.cta-box'],['faq','.faq-section>.container'],['footer','.footer-grid']])await audit(state,selector,{shot:state==='footer'});
  await page.locator('.faq-item button').first().click();await audit('faq-expanded','.faq-section>.container');
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  const navBefore=await page.locator('.bottom-nav').boundingBox();assert.ok(Math.abs(navBefore.y+navBefore.height-height)<1);if(engine==='chromium'&&lang==='en'&&width===820)await page.screenshot({path:join(shots,`issue-09-${phase}-bottom-navigation-scroll.png`)});
  await go('groups');await page.locator('.group-card').first().waitFor();await audit('groups','.panel',{shot:true});
  await page.getByRole('button',{name:tr('مجموعة جديدة'),exact:true}).click();await audit('create','.form-page',{shot:true});await page.locator('.group-form-options summary').click();await audit('create-options','.form-page');
  await page.locator('.segmented').getByRole('button',{name:tr('انضم لمجموعة'),exact:true}).click();await audit('join','.form-page');
  await page.getByRole('button',{name:tr('القائمة'),exact:true}).click();await audit('menu','.menu-panel',{shot:true});await menu.getByRole('button',{name:t.groups,exact:true}).click();
  await page.locator('.group-card').first().click();await audit('group-owner','.group-detail',{shot:true});
  const savedName=group.name;group.name='QA '+'LongGroupName'.repeat(12);await groupPage();await audit('group-long-content','.group-detail');group.name=savedName;await groupPage();
  await page.getByRole('button',{name:tr('إغلاق المجموعة'),exact:true}).click();await audit('confirmation','.confirm-panel');await page.locator('.confirm-panel').getByRole('button',{name:tr('إلغاء'),exact:true}).click();
  for(const view of ['map','compass','meeting']){
    await go(view);const permission=page.locator('.permission-panel');if(await permission.count()){
      await audit(`${view}-permission`,'.permission-panel');
      if(view==='map'){await permission.getByRole('button',{name:tr('تفعيل الموقع'),exact:true}).click();await permission.waitFor({state:'hidden'});}
      else await permission.getByRole('button',{name:tr('ليس الآن'),exact:true}).click();
    }
    await audit(view,'.dal-navigation',{shot:true});
    if(view==='map'){
      await page.locator('.has-location-consent').waitFor();await audit('map-gps','.dal-navigation');
      await page.locator('.member-row button').first().click();await page.locator('.walking-route-status').waitFor();await audit('walking-route','.dal-navigation');
      await page.locator('.nav-assistant').getByRole('button',{name:tr('ساعدني أوصل'),exact:true}).click();await page.locator('.nav-assistant .ai-result').waitFor();await audit('ai-reunion','.dal-navigation');
      await page.locator('.nav-assistant .ai-details summary').click();await audit('ai-reunion-details','.dal-navigation');
    }
    if(view==='compass'){
      await page.locator('.dal-live-compass').getByRole('button',{name:tr('وجّهني لأقرب عضو'),exact:true}).click();await audit('compass-nearest','.dal-navigation');
      await page.locator('.dal-live-compass').getByRole('button',{name:tr('وجّهني إلى نقطة الالتقاء'),exact:true}).click();await audit('compass-meeting','.dal-navigation');
    }
    if(view==='meeting'){
      await page.locator('.leaflet-container').click({position:{x:150,y:300}});await audit('meeting-draft','.dal-navigation');
      await page.getByRole('textbox',{name:tr('اسم المرشح'),exact:true}).fill('QA Candidate');await page.getByRole('button',{name:tr('إضافة النقطة المختارة كمرشح'),exact:true}).click();
      await page.getByRole('button',{name:tr('اقترح نقطة لقاء بالذكاء الاصطناعي'),exact:true}).click();await page.locator('.nav-assistant .ai-result').waitFor();await audit('ai-meeting','.dal-navigation');
      await page.locator('.nav-assistant .ai-details summary').click();await audit('ai-meeting-details','.dal-navigation');
      await page.getByRole('button',{name:tr('حذف نقطة اللقاء'),exact:true}).click();await audit('meeting-delete-confirmation','.confirm-panel');await closeDialog();
    }
  }
  await go('chat');await page.locator('.message').first().waitFor();await audit('chat-group','.chat-page',{shot:true});
  const input=page.locator('.chat-input input');let ir=await input.boundingBox(),nr=await page.locator('.bottom-nav').boundingBox();matrix.push({phase,engine,language:lang,viewport:`${width}x${height}`,state:'chat-composer',navOverlap:ir.y+ir.height>nr.y+1});if(phase==='after')assert.ok(ir.y+ir.height<=nr.y+1);
  await input.fill('Synthetic draft');await input.focus();await audit('chat-focused','.chat-page');
  await page.setViewportSize({width,height:Math.max(380,height-360)});const focused=await input.boundingBox();assert.ok(focused.y+focused.height<=Math.max(380,height-360)+1);await audit('chat-keyboard-resized','.chat-page');await page.setViewportSize({width,height});await input.blur();
  await page.locator('.chat-tabs').getByRole('button',{name:tr('المحادثات الخاصة'),exact:true}).click();await page.locator('.message').first().waitFor();await audit('chat-private','.chat-page');
  await page.locator('.chat-heading select').selectOption('');await audit('chat-no-member','.chat-page');
  chatMode='empty';await page.locator('.chat-tabs').getByRole('button',{name:tr('محادثة المجموعة'),exact:true}).click();await page.getByText(tr('ابدأ محادثة المجموعة'),{exact:true}).waitFor();await audit('chat-empty','.chat-page');
  chatMode='error';await go('settings');await go('chat');await page.locator('.chat-page [role=alert]').waitFor();await audit('chat-error','.chat-page');await page.getByRole('button',{name:tr('إغلاق الخطأ'),exact:true}).click();chatMode='ready';
  chatMode='loading';await go('settings');await go('chat');await page.getByText(tr('جارٍ تحميل المحادثة…'),{exact:true}).waitFor();await audit('chat-loading','.chat-page');chatMode='ready';releaseChat();
  await go('settings');await audit('settings','.panel.narrow',{shot:true});await page.getByRole('button',{name:tr('إيقاف المشاركة في الكل'),exact:true}).click();await audit('sharing-confirmation','.confirm-panel');await page.locator('.confirm-panel').getByRole('button',{name:tr('إلغاء'),exact:true}).click();
  await page.getByRole('button',{name:tr('الإشعارات'),exact:true}).click();await page.locator('.notification-item').waitFor();await audit('notifications','.panel',{shot:true});
  for(const mode of ['empty','error']){notificationsMode=mode;await go('settings');await page.getByRole('button',{name:tr('الإشعارات'),exact:true}).click();await page.locator('.empty').waitFor();await audit(`notifications-${mode}`,'.panel');}
  notificationsMode='loading';await go('settings');await page.getByRole('button',{name:tr('الإشعارات'),exact:true}).click();await page.getByText(tr('جارٍ تحميل التنبيهات…'),{exact:true}).waitFor();await audit('notifications-loading','.panel');notificationsMode='ready';releaseNotifications();
  if(await page.getByRole('button',{name:tr('إغلاق الخطأ'),exact:true}).count())await page.getByRole('button',{name:tr('إغلاق الخطأ'),exact:true}).click();
  for(const mode of ['empty','error','loading']){
    groupsMode=mode;await go('settings');await go('groups');await page.locator('.panel').waitFor();
    await page.getByText(tr(mode==='empty'?'ما عندك مجموعات حتى الآن':mode==='error'?'تعذر تحميل المجموعات':'جارٍ تحميل مجموعاتك…'),{exact:true}).waitFor();await audit(`groups-${mode}`,'.panel');
    if(mode==='loading'){groupsMode='ready';releaseGroups();await page.locator('.group-card').first().waitFor();}
    if(await page.getByRole('button',{name:tr('إغلاق الخطأ'),exact:true}).count())await page.getByRole('button',{name:tr('إغلاق الخطأ'),exact:true}).click();
  }
  for(const nextRole of ['ADMIN','MEMBER']){role=nextRole;await groupPage();await audit(`group-${nextRole.toLowerCase()}`,'.group-detail');}
  await page.waitForLoadState('networkidle');authenticated=false;await page.goto(base);await page.locator('.site-nav').waitFor();await audit('home-guest','.hero-inner');
  await page.locator('.hero-actions .filled').first().click();await audit('login','.form-page',{shot:true});await page.locator('.segmented').getByRole('button',{name:tr('حساب جديد'),exact:true}).click();await audit('register','.form-page');
  await page.getByRole('button',{name:tr('نسيت الباسوورد؟'),exact:true}).click();await audit('forgot','.panel.narrow');
  await page.waitForLoadState('networkidle');await page.goto(base+'/reset-password');await audit('reset-missing-token','.panel.narrow');await page.waitForLoadState('networkidle');await page.goto(base+'/reset-password?token=synthetic');await audit('reset','.panel.narrow');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await context.close();console.log(`${phase} ${engine} ${width}x${height} ${lang}: ${matrix.length} audit rows`);
}}catch(error){fatal=error;}finally{await browser.close();await writeFile(join(output,`${phase}-${engine}.json`),JSON.stringify({phase,engine,matrix,error:fatal?.message||null},null,2));}
if(fatal)throw fatal;
