import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {compassPath,advanceCompassWaypoint} from '../src/utils/walkingCompass.js';
import {bearingBetween,distanceBetween} from '../src/utils/navigationCalculations.js';
import {translate} from '../src/i18n.js';
const require=createRequire(import.meta.url);
const bundle=await build({stdin:{contents:"export {default as hook} from './src/hooks/useWalkingCompass.js';export {default as Compass} from './src/components/navigation/LiveCompass.jsx';export {LanguageProvider} from './src/LanguageContext.jsx';",resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,write:false,format:'esm',plugins:[{name:'react',setup(b){b.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}));}}]});
const {hook,Compass,LanguageProvider}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const now=Date.now(),stamp=new Date(now).toISOString(),key='10:2:authorized';
const own={latitude:24,longitude:46,accuracy:5,recordedAt:stamp};
const target={latitude:24.001,longitude:46.001,userId:2,name:'Synthetic member',sharingEnabled:true,visibleUntil:null,recordedAt:stamp};
const coordinates=[[24,46],[24,46.001],[24.001,46.001]],path=compassPath(coordinates);
const result={status:'READY',coordinates,distanceMeters:212,durationSeconds:160,calculatedAt:now,key};
const input=()=>({walking:{available:true,result},own,target,online:true,now,gpsReady:true,authorized:true,destinationKey:key});
function probe(props){let value,tree;function Probe(p){value=hook(p);return null;}act(()=>tree=Renderer.create(React.createElement(Probe,props)));return{get value(){return value;},update(patch){props={...props,...patch};act(()=>tree.update(React.createElement(Probe,props)));},close(){act(()=>tree.unmount());}};}
test('walking uses latitude/longitude geometry and points along the path, unlike direct bearing',()=>{
 const v=advanceCompassWaypoint(path,own);assert.equal(v.status,'ready');assert.ok(Math.abs(v.bearing-90)<.01);assert.ok(bearingBetween(own,target)<50);assert.equal(v.segment,0);assert.ok(distanceBetween(v.waypoint,target)>100);assert.ok(v.remainingMeters>200);
});
test('waypoint advances around a corner and remaining path distance decreases',()=>{
 const first=advanceCompassWaypoint(path,own),second=advanceCompassWaypoint(path,{...own,longitude:46.0002},first);
 assert.ok(second.progress>first.progress);assert.ok(second.remainingMeters<first.remainingMeters);
 // Incremental fixes, as on a real walk, retain bounded progress.
 let progress=second;for(let i=3;i<=10;i++)progress=advanceCompassWaypoint(path,{...own,longitude:46+i*.0001},progress);
 const corner=advanceCompassWaypoint(path,{...own,latitude:24.0001,longitude:46.001},progress);
 assert.equal(corner.segment,1);assert.ok(Math.min(corner.bearing,360-corner.bearing)<1);assert.ok(corner.progress>100);
});
test('small GPS noise cannot move progress backward or skip onto a nearby return leg',()=>{
 let v=advanceCompassWaypoint(path,{...own,longitude:46.0003});const p=v.progress;
 for(const noise of [-.000005,.000005,-.00001,.00001]){v=advanceCompassWaypoint(path,{...own,longitude:46.0003+noise},v);assert.equal(v.progress,p);assert.equal(v.segment,0);}
 const loop=compassPath([[24,46],[24,46.001],[24.00004,46.001],[24.00004,46]]);
 const first=advanceCompassWaypoint(loop,own),nearReturn=advanceCompassWaypoint(loop,{...own,latitude:24.00004,longitude:46.00005},first);
 assert.equal(nearReturn.segment,0);assert.ok(nearReturn.progress<10);
});
test('off-route and inaccurate GPS produce no invented bearing or distance',()=>{
 for(const p of [{...own,latitude:24.0006},{...own,accuracy:90},{...own,accuracy:undefined}]){const v=advanceCompassWaypoint(path,p);assert.notEqual(v.status,'ready');assert.equal(v.bearing,undefined);assert.equal(v.remainingMeters,undefined);}
});
test('malformed/degenerate geometry is rejected and duplicate points are safe',()=>{
 for(const c of [null,[],[[24,46]],[[24,46],[NaN,46]],[[24,46],[24,46]]])assert.equal(compassPath(c),null);
 assert.equal(advanceCompassWaypoint(compassPath([[24,46],[24,46],[24,46.001]]),own).status,'ready');
});
test('antimeridian path interpolation remains geographic',()=>{
 const v=advanceCompassWaypoint(compassPath([[0,179.999],[0,-179.999]]),{...own,latitude:0,longitude:179.999});assert.ok(v.bearing>89&&v.bearing<91);assert.ok(v.remainingMeters<230);
});
test('route arrival never invents heading or confirms a meeting automatically',()=>{
 const v=advanceCompassWaypoint(path,{...own,...target});assert.equal(v.remainingMeters,0);assert.equal(v.bearing,null);
});
test('valid route defaults to walking; repeated mode changes never fetch or enable sensors',()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('No requests expected');};const p=probe(input());
 try{assert.equal(p.value.mode,'walking');for(let i=0;i<8;i++){act(()=>p.value.setMode('direct'));assert.equal(p.value.mode,'direct');act(()=>p.value.setMode('walking'));assert.equal(p.value.mode,'walking');}assert.equal(calls,0);}finally{p.close();globalThis.fetch=original;}
});
test('without a route direct stays intact, while explicit walking remains selected through failure/recovery',()=>{
 const p=probe({...input(),walking:{available:true,result:null}});assert.equal(p.value.mode,'direct');act(()=>p.value.setMode('walking'));assert.equal(p.value.status,'unavailable');p.update({walking:{available:true,result}});assert.equal(p.value.mode,'walking');assert.equal(p.value.status,'ready');p.update({online:false});assert.notEqual(p.value.status,'ready');assert.equal(p.value.mode,'walking');p.close();
});
test('explicit direct preference survives route arrival and recalculation',()=>{
 const p=probe({...input(),walking:{available:true,result:null}});act(()=>p.value.setMode('direct'));p.update({walking:{available:true,result}});assert.equal(p.value.mode,'direct');p.update({walking:{available:true,result:{...result,calculatedAt:now+1}}});assert.equal(p.value.mode,'direct');p.close();
});
for(const [name,patch]of[
 ['GPS denial/revocation',{gpsReady:false}],['stale GPS',{own:{...own,recordedAt:new Date(now-30001).toISOString()}}],
 ['stale member',{target:{...target,recordedAt:new Date(now-30001).toISOString()}}],['revoked sharing',{target:{...target,sharingEnabled:false}}],
 ['expired sharing',{target:{...target,visibleUntil:new Date(now).toISOString()}}],['unauthorized group',{authorized:false}],
 ['offline',{online:false}],['recalculation',{walking:{available:true,result,updating:true}}],['Backend access rejection',{walking:{available:true,result,blocked:true}}],
 ['old geometry',{walking:{available:true,result:{...result,outdated:true}}}],['expired route',{now:now+30000,own:{...own,recordedAt:new Date(now+30000).toISOString()},target:{...target,recordedAt:new Date(now+30000).toISOString()}}],
 ['wrong destination',{destinationKey:'10:3:authorized'}],['wrong group',{destinationKey:'11:2:authorized'}],
 ['provider failure',{walking:{available:true,result:{status:'UNAVAILABLE'}}}],['invalid geometry',{walking:{available:true,result:{...result,coordinates:[[NaN,46],[24,46]]}}}]
])test(`${name} blocks walking guidance without silently switching modes`,()=>{const p=probe(input());p.update(patch);assert.notEqual(p.value.status,'ready');assert.equal(p.value.bearing,undefined);assert.equal(p.value.remainingMeters,undefined);assert.equal(p.value.mode,'walking');p.close();});
test('new route/destination resets progress and discards old waypoints',()=>{
 const p=probe({...input(),own:{...own,longitude:46.0007}});assert.ok(p.value.progress>60);
 const next={...result,key:'10:meeting:authorized',calculatedAt:now+1,coordinates:[[24,46],[24.001,46]],distanceMeters:111};
 p.update({own,target:{latitude:24.001,longitude:46},destinationKey:next.key,walking:{available:true,result:next}});
 assert.equal(p.value.progress,0);assert.ok(p.value.bearing<1);p.close();
});
for(const lang of ['ar','en','fr'])test(`both Compass modes, sensor fallback and real translations in ${lang}`,()=>{
 let tree;const sensor={heading:null,supported:true,status:'denied',enable(){}};const props={own,target,online:true,now,sensor,routeCompass:{mode:'direct',setMode(){}}};
 const render=p=>React.createElement(LanguageProvider,{lang},React.createElement(Compass,p));act(()=>tree=Renderer.create(render(props)));
 try{const all=()=>JSON.stringify(tree.toJSON());assert.ok(all().includes(translate('اتجاه مباشر',lang)));assert.ok(all().includes(translate('عبر الطريق',lang)));let dial=tree.root.findByProps({className:'dal-compass-dial'});assert.ok(dial.props['aria-label'].includes(String(Math.round(bearingBetween(own,target)))));const retry=tree.root.findAllByType('button').find(b=>b.props.className==='outline compass-permission');assert.equal(retry.props.disabled,false);
 act(()=>tree.update(render({...props,routeCompass:{mode:'walking',status:'ready',bearing:90,remainingMeters:210,setMode(){}}})));assert.ok(all().includes(translate('اتبع مسار المشي',lang)));assert.ok(all().includes('≈ '));assert.ok(all().includes(translate('مسافة مشي متبقية تقريبية على المسار المحسوب',lang)));
 act(()=>tree.update(render({...props,routeCompass:{mode:'walking',status:'unavailable',setMode(){}}})));assert.equal(tree.root.findAllByProps({className:'dal-direction-arrow'}).length,0);
 act(()=>tree.update(render({...props,routeCompass:{mode:'direct',status:'blocked',setMode(){}}})));assert.equal(tree.root.findAllByProps({className:'dal-direction-arrow'}).length,0);
 }finally{act(()=>tree.unmount());}
});
