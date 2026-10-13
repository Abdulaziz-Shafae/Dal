// Opt-in after the owner approves and deploys. Existing synthetic QA accounts only.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {isAbsolute} from 'node:path';
if(process.env.DAL_QA_ORS_APPROVED!=='true') {
  console.error('Verification is disabled. Obtain owner approval after deployment first.');
  process.exit(2);
}
const credentialsPath=process.env.DAL_QA_CREDENTIALS_PATH;
if(!credentialsPath || !isAbsolute(credentialsPath)) {
  console.error('Set DAL_QA_CREDENTIALS_PATH to the absolute path of your private QA fixture outside Git.');
  process.exit(2);
}
const credentialsUrl=pathToFileURL(credentialsPath);
const result={walkingRequests:0,maximumWalkingRequests:2,routes:[],passed:false,logoutCompleted:true};
const sessions=[];
class VerificationError extends Error {}
async function request(session,path,method='GET',body) {
  if(method!=='GET'&&!session.csrf) session.csrf=(await request(session,'/security/csrf')).data;
  const headers={Accept:'application/json'};
  if(Object.keys(session.cookies).length) headers.Cookie=Object.entries(session.cookies).map(([k,v])=>k+'='+v).join('; ');
  if(body!==undefined) headers['Content-Type']='application/json';
  if(method!=='GET') headers[session.csrf.headerName]=session.csrf.token;
  const response=await fetch('https://dal.up.railway.app/api/v1'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  for(const cookie of response.headers.getSetCookie()){const first=cookie.split(';')[0],i=first.indexOf('=');session.cookies[first.slice(0,i)]=first.slice(i+1);}
  if(!response.ok) throw new VerificationError('QA endpoint returned HTTP '+response.status+'; no retry performed');
  const data=await response.json();if(['/user/login','/user/logout'].includes(path))session.csrf=null;
  return {status:response.status,data};
}
try {
  const qa=JSON.parse(await readFile(credentialsUrl,'utf8'));
  if(qa.accounts?.length!==4||qa.group?.name!=='DAL-QA-'+qa.runId) throw new VerificationError('Expected existing QA fixture is missing');
  const owner=qa.accounts.find(a=>a.name==='DAL QA Owner'),member=qa.accounts.find(a=>a.name==='DAL QA Member 1');
  for(const account of [owner,member]) {
    if(!account?.registered||!Number.isInteger(account.id)||!account.email?.endsWith('@example.com')) throw new VerificationError('Expected QA identity is missing');
    const session={cookies:{},csrf:null,loggedIn:false};sessions.push(session);
    await request(session,'/user/login','POST',{email:account.email,password:account.password});session.loggedIn=true;
    const profile=(await request(session,'/user/profile')).data;
    if(profile.id!==account.id||profile.name!==account.name) throw new VerificationError('QA identity mismatch');
  }
  const group=(await request(sessions[0],'/group/'+qa.group.id)).data;
  const memberships=(await request(sessions[0],'/group-member/group/'+qa.group.id)).data;
  if(group.name!==qa.group.name||group.myRole!=='OWNER'||!memberships.some(m=>m.userId===member.id)) throw new VerificationError('QA group ownership/membership mismatch');
  for(const [i,session]of sessions.entries()) {
    const global=(await request(session,'/sharing')).data,local=(await request(session,'/sharing/group/'+qa.group.id)).data;
    if(!global.sharingEnabled||!local.sharingEnabled) throw new VerificationError('QA sharing must already be enabled; no settings were changed');
    const point=qa.syntheticPoints?.[i];
    if(!point||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180) throw new VerificationError('Declared synthetic QA fixture missing');
    await request(session,'/location/update','POST',{...point,recordedAt:new Date().toISOString()});
  }
  const meeting=(await request(sessions[0],'/meeting-point/group/'+qa.group.id)).data;
  if(meeting.id!==qa.meeting?.id||meeting.name!=='DAL QA TEST MEETING') throw new VerificationError('Expected QA meeting changed; no meeting was created or edited');
  for(const destination of [{label:'QA member',memberId:member.id,meetingPoint:false},{label:'QA meeting',memberId:null,meetingPoint:true}]) {
    result.walkingRequests++;
    const response=await request(sessions[0],'/navigation/group/'+qa.group.id+'/walking','POST',{memberId:destination.memberId,meetingPoint:destination.meetingPoint});
    const route=response.data;
    result.routes.push({destination:destination.label,httpStatus:response.status,status:route.status,distanceMeters:route.distanceMeters,durationSeconds:route.durationSeconds,pointCount:route.coordinates?.length||0});
    if(route.status!=='READY'||route.coordinates?.length<2||!Number.isFinite(route.distanceMeters)||route.distanceMeters<=0||!Number.isFinite(route.durationSeconds)||route.durationSeconds<=0) throw new VerificationError('Walking route unavailable/invalid; stop and inspect sanitized ORS logs before another attempt');
  }
  result.passed=true;
} catch(error) {
  // Only our own fixed messages or an exception class, never the raw request/response/exception message.
  result.error=error instanceof VerificationError ? error.message : 'Verification stopped due to '+error.constructor.name;
} finally {
  for(const session of sessions) if(session.loggedIn) {
    try {await request(session,'/user/logout','POST');}catch{result.logoutCompleted=false;}
    session.cookies={};session.csrf=null;
  }
  if(!result.logoutCompleted) {result.passed=false;result.error??='QA logout could not be confirmed; no retry performed';}
}
await writeFile(new URL('ors-verification-after-deploy.json',credentialsUrl),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!result.passed) process.exitCode=1;
