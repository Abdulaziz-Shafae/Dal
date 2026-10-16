// Local-only chat regression: all accounts and API responses are synthetic.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { translate } from '../src/i18n.js';
import { texts } from '../src/translations.js';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.DAL_QA_MODULES?join(process.env.DAL_QA_MODULES,'playwright'):'playwright');
const phase=process.argv[2]||'after',engine=process.argv[3]||'chromium',base=process.env.DAL_QA_BASE_URL||'http://localhost:5189';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output=join(tmpdir(),'dal-chat-laptop'),shots=output;
await mkdir(output,{recursive:true});await mkdir(shots,{recursive:true});
const sizes=process.env.DAL_QA_VIEWPORTS?JSON.parse(process.env.DAL_QA_VIEWPORTS):[[1366,768],[1280,720],[390,844]];
const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true}));
const matrix=[];let fatal,contextIndex=0;
try {for(const [width,height]of sizes)for(const lang of(process.env.DAL_QA_LANGUAGES?.split(',')||['ar','en'])){
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
      else data={content:chatMode==='empty'?[]:Array.from({length:25},(_,i)=>({id:25-i,senderId:i%2?1:2,senderName:'QA Member',content:'Synthetic layout message '+i,createdAt:new Date().toISOString(),readAt:i%2?new Date().toISOString():null})),last:true};
    }
    else if(path.endsWith('/walking'))data={status:'READY',coordinates:[[24.7136,46.6753],[24.7139,46.6753]],distanceMeters:100,durationSeconds:80};
    else if(path.endsWith('/reunion-assistance'))data={source:'RULES',locationStatus:'RECENT',recommendation:'استخدم طريق المشي المحسوب إن توفر، أو البوصلة باتجاه الوجهة مع مراعاة حدود الخرائط.',reason:'Synthetic explanation '.repeat(18),warning:'دقة GPS منخفضة أو غير معروفة؛ المسافات والاتجاه تقريبيان.',walkingDistanceMeters:100,action:'FOLLOW_ROUTE'};
    else if(path.endsWith('/meeting-suggestions'))data={source:'RULES',ranking:[{index:0,name:'QA Candidate',latitude:meeting.latitude,longitude:meeting.longitude,maximumDistanceMeters:100}],includedMembers:3,excludedMembers:0,reason:'Synthetic explanation '.repeat(18),warning:'دقة GPS منخفضة أو غير معروفة؛ المسافات والاتجاه تقريبيان.'};
    else {unexpected.push(path);return route.fulfill({status:404,json:{message:'Unexpected synthetic endpoint'}});}
    return route.fulfill({status:200,json:data});
  });

  await page.goto(base);await page.locator('.bottom-nav').waitFor();
  await page.locator('.bottom-nav').getByRole('button',{name:t.chat,exact:true}).click();
  await page.locator('.group-card').first().click();
  await page.locator('.message').first().waitFor();
  for(const tab of ['group','private']){
    if(tab==='private')await page.locator('.chat-tabs button').nth(1).click();
    await page.locator('.message').first().waitFor();
    const input=page.locator('.chat-input input'),messages=page.locator('.messages');
    const bottom=()=>messages.evaluate(el=>({top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight,gap:el.scrollHeight-el.clientHeight-el.scrollTop}));
    const initial=await bottom();await input.focus();
    const navVisible=await page.locator('.bottom-nav').isVisible();
    const bounds=await input.boundingBox();
    const row={viewport:`${width}x${height}`,language:lang,tab,initial,navVisible,inputBottom:bounds.y+bounds.height};matrix.push(row);
    await page.screenshot({path:join(shots,`${phase}-${width}-${lang}-${tab}.png`)});
    if(phase==='after'){
      assert.ok(initial.gap<=2,JSON.stringify(row));
      if(width>760)assert.ok(navVisible,JSON.stringify(row));
      const limit=navVisible?(await page.locator('.bottom-nav').boundingBox()).y:height;
      assert.ok(bounds.y+bounds.height<=limit+1,JSON.stringify(row));
      await messages.evaluate(el=>el.scrollTop=0);await page.waitForTimeout(100);
      await page.waitForTimeout(8200);assert.ok((await bottom()).top<=2);
    }
    await input.blur();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await context.close();
}}catch(error){fatal=error;}finally{await browser.close();await writeFile(join(output,`${phase}-${engine}.json`),JSON.stringify({phase,engine,matrix,error:fatal?.message||null},null,2));}
if(fatal)throw fatal;
console.log(JSON.stringify(matrix));
