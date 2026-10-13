import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const code=await build({stdin:{contents:"export {default as Picker} from './src/components/navigation/MeetingPointPicker.jsx'; export {default as Reunion} from './src/components/navigation/ReunionAssistant.jsx'; export {default as Suggestions} from './src/components/navigation/MeetingSuggestions.jsx';",resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,write:false,format:'esm',define:{'import.meta.env.VITE_API_BASE_URL':"''"},plugins:[{name:'react',setup(b){b.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}));}}]});
const {Picker,Reunion,Suggestions}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
let tree;const originalFetch=globalThis.fetch;
afterEach(()=>{if(tree)act(()=>tree.unmount());tree=null;globalThis.fetch=originalFetch;});
const render=(Component,props)=>act(()=>{tree=Renderer.create(React.createElement(Component,props));});
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const button=label=>tree.root.findAllByType('button').find(node=>text(node)===label);

test('meeting picker keeps coordinates in state, saves chosen map point and cancels selection',()=>{
  let saved,cancelled;const props={meeting:{name:'بوابة اللقاء',latitude:24,longitude:46},draft:{latitude:24.01,longitude:46.01},save:p=>saved=p,onDraft:p=>cancelled=p,canManage:true,online:true,busy:false};
  render(Picker,props);
  assert.equal(tree.root.findAllByType('input').length,1);
  act(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.deepEqual(saved,{name:'بوابة اللقاء',latitude:24.01,longitude:46.01});
  act(()=>button('إلغاء الاختيار').props.onClick());assert.equal(cancelled,null);
});
test('meeting picker preserves permission, offline and coordinate guards',()=>{
  const props={meeting:{name:'لقاء',latitude:24,longitude:46},canManage:false,online:true};
  render(Picker,props);assert.equal(tree.root.findAllByType('form').length,0);
  act(()=>tree.update(React.createElement(Picker,{...props,canManage:true,online:false})));assert.equal(button('حفظ نقطة اللقاء').props.disabled,true);
  act(()=>tree.update(React.createElement(Picker,{...props,canManage:true,meeting:null})));assert.equal(button('حفظ نقطة اللقاء').props.disabled,true);
});
test('reunion retains exact recommendation and warning, with full AI reason in closed details',async()=>{
  const advice={source:'OPENAI',locationStatus:'STALE',recommendation:'الموقع قديم؛ تواصل مع العضو.',warning:'تحذير السلامة كامل دون حذف.',reason:'شرح طويل من API. '.repeat(20),action:'CONTACT_MEMBER',walkingDistanceMeters:120};
  globalThis.fetch=async url=>new Response(JSON.stringify(url.endsWith('/csrf')?{token:'test',headerName:'X-CSRF-TOKEN'}:advice));
  render(Reunion,{groupId:1,target:{userId:2},online:true,onError:e=>{throw e;},onMeeting(){},onNudge(){}});
  await act(async()=>button('ساعدني أوصل').props.onClick());
  const details=tree.root.findByType('details'),status=tree.root.findByProps({role:'status'});
  assert.equal(details.props.open,undefined);assert.ok(text(details).includes(advice.reason));
  assert.ok(text(status).includes(advice.recommendation));assert.ok(text(status).includes(advice.warning));assert.ok(!text(status).includes(advice.reason));
  assert.ok(button('نبّه العضو'));
});
test('meeting suggestion uses actual best name and retains warning, ranking and save payload',()=>{
  let saved;const best={index:2,name:'مرشح من API',latitude:24,longitude:46,maximumDistanceMeters:180};
  const suggestion={source:'OPENAI',reason:'التفاصيل الكاملة من API.',warning:'تحقق من صلاحية المكان.',includedMembers:2,excludedMembers:1,ranking:[best]};
  render(Suggestions,{groupId:1,candidates:[],setCandidates(){},suggestion,setSuggestion(){},online:true,save:p=>saved=p,onError(){}});
  assert.ok(text(tree.root).includes('أفضل نقطة: '+best.name));
  assert.ok(text(tree.root.findByProps({className:'ai-warning'})).includes(suggestion.warning));
  assert.ok(text(tree.root.findByType('details')).includes(suggestion.reason));
  act(()=>button('اعتماد وحفظ '+best.name).props.onClick());assert.deepEqual(saved,{name:best.name,latitude:best.latitude,longitude:best.longitude});
});
