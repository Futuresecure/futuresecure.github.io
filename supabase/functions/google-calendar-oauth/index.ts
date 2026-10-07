// Custom authentication: CRM JWT for start/status, random worker credential for jobs,
// single-use random state + PKCE for Google's public callback. No secrets reach the UI.
const SB = Deno.env.get('SUPABASE_URL');
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CLIENT = Deno.env.get('GOOGLE_CLIENT_ID');
const SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const OWNER = '4bd1c093-0912-4e63-a062-21d8fd759357';
const HOME = 'https://futuresecureproviders.com/crm/';
const CALLBACK = SB + '/functions/v1/google-calendar-oauth/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CORS = {'Access-Control-Allow-Origin':'https://futuresecureproviders.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const enc = new TextEncoder();
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const unb64 = s => Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const digest = async s => b64(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json'}});
class SafeError extends Error { constructor(message,status=400){super(message);this.status=status;} }
async function fetchTimed(url,opts={}) { return await fetch(url,{...opts,signal:AbortSignal.timeout(12000)}); }
async function db(path,method='GET',body,prefer='return=representation') {
 const r=await fetchTimed(SB+'/rest/v1/'+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)throw new SafeError('Backend database operation failed',500);
 const text=await r.text();return text?JSON.parse(text):null;
}
async function cryptKey(){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('fsp-calendar-v1:'+SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(text){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await cryptKey(),enc.encode(text)));}
async function unseal(text){const [iv,data]=text.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await cryptKey(),unb64(data)));}
async function owner(req){
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))throw new SafeError('Sign in to CRM first',401);
 const r=await fetchTimed(SB+'/auth/v1/user',{headers:{apikey:KEY,Authorization:auth}});
 if(!r.ok)throw new SafeError('CRM session expired. Sign in again.',401);
 const u=await r.json();if(u.id!==OWNER)throw new SafeError('Only the CRM administrator can connect this calendar',403);
 return u.id;
}
function configured(){if(!CLIENT||!SECRET)throw new SafeError('Google client secrets are not configured',503);}
async function token(params){
 const r=await fetchTimed('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT,client_secret:SECRET,...params})});
 const data=await r.json();
 if(!r.ok)throw new SafeError(data.error==='invalid_grant'?'Google authorization expired. Reconnect Calendar.':'Google token exchange failed; retry or check OAuth client settings',data.error==='invalid_grant'||data.error==='invalid_client'?401:503);
 if(!data.access_token)throw new SafeError('Google returned no access token',503);
 return data;
}
async function start(uid){
 configured();
 const state=random(),verifier=random();
 // Bound storage and invalidate previous authorization attempts for this administrator.
 await db('google_calendar_oauth_states?owner_id=eq.'+uid,'DELETE');
 await db('google_calendar_oauth_states','POST',{state_hash:await digest(state),owner_id:uid,verifier_encrypted:await seal(verifier),expires_at:new Date(Date.now()+10*60000).toISOString()});
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:CLIENT,redirect_uri:CALLBACK,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent select_account',state,code_challenge:await digest(verifier),code_challenge_method:'S256'}).toString();
 return json({ok:true,url:url.href});
}
async function callback(url){
 configured();
 const state=url.searchParams.get('state')||'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(state))throw new SafeError('Invalid authorization state. Connect from CRM again.');
 // DELETE RETURNING makes state single-use, even for concurrent callbacks.
 const rows=await db('google_calendar_oauth_states?state_hash=eq.'+await digest(state)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'DELETE');
 const row=rows?.[0];if(!row||row.owner_id!==OWNER)throw new SafeError('Authorization link expired or was used. Connect from CRM again.');
 if(url.searchParams.has('error'))throw new SafeError('Google permission was not granted. Connect from CRM to try again.');
 const code=url.searchParams.get('code');if(!code)throw new SafeError('Missing authorization code');
 const t=await token({code,grant_type:'authorization_code',redirect_uri:CALLBACK,code_verifier:await unseal(row.verifier_encrypted)});
 if(!t.refresh_token)throw new SafeError('Google did not grant offline access. Reconnect and allow Calendar access.');
 if(!(t.scope||'').split(' ').includes(SCOPE))throw new SafeError('Calendar events permission is required. Reconnect and select Calendar permission.');
 await db('google_calendar_connection?on_conflict=id','POST',{id:true,owner_id:OWNER,refresh_encrypted:await seal(t.refresh_token),scope:t.scope,status:'connected',connected_at:new Date().toISOString()},'resolution=merge-duplicates,return=representation');
 await db('rpc/fsp_calendar_enqueue_all','POST',{});
 return new Response(null,{status:303,headers:{Location:HOME+'?calendar=connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export function eventPatch(appt,event){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(appt.appointment_date)||!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(appt.appointment_time))throw new SafeError('Invalid appointment date or time');
 if(event.status==='cancelled'||event.recurrence||event.recurringEventId)throw new SafeError('Cancelled or recurring Google event requires manual review');
 const start=new Date(appt.appointment_date+'T'+appt.appointment_time+'+05:30');
 const duration=Date.parse(event.end?.dateTime)-Date.parse(event.start?.dateTime);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(duration)||duration<=0)throw new SafeError('Google event must have a valid timed duration');
 return {start:{dateTime:start.toISOString(),timeZone:'Asia/Kolkata'},end:{dateTime:new Date(start.getTime()+duration).toISOString(),timeZone:'Asia/Kolkata'}};
}
async function googleEvent(appt,access){
 // Never insert an event or replace an event ID during reschedule.
 const endpoint='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(appt.google_calendar_id||'primary')+'/events/'+encodeURIComponent(appt.google_calendar_event_id);
 const r=await fetchTimed(endpoint,{headers:{Authorization:'Bearer '+access}});
 if(!r.ok)throw new SafeError(r.status===404?'Linked event not found in this Google calendar':r.status===403?'Google denied Calendar access':'Google Calendar temporarily unavailable');
 const event=await r.json();const patch=eventPatch(appt,event);
 const equal=Date.parse(event.start.dateTime)===Date.parse(patch.start.dateTime)&&Date.parse(event.end.dateTime)===Date.parse(patch.end.dateTime);
 if(equal)return;
 if(!event.etag)throw new SafeError('Google event version is missing');
 const update=await fetchTimed(endpoint+'?sendUpdates=none',{method:'PATCH',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json','If-Match':event.etag},body:JSON.stringify(patch)});
 if(!update.ok)throw new SafeError(update.status===412?'Event changed during sync; retry scheduled':'Google Calendar update failed; retry scheduled');
 const updated=await update.json();
 if(updated.id!==appt.google_calendar_event_id||Date.parse(updated.start?.dateTime)!==Date.parse(patch.start.dateTime)||Date.parse(updated.end?.dateTime)!==Date.parse(patch.end.dateTime))throw new SafeError('Google event update could not be verified');
}
async function runJobs(){
 configured();
 const connections=await db('google_calendar_connection?id=eq.true');const conn=connections?.[0];
 if(!conn||conn.status!=='connected')return {ok:true,connected:false,processed:0};
 let t;
 try{t=await token({refresh_token:await unseal(conn.refresh_encrypted),grant_type:'refresh_token'});}
 catch(e){if(e instanceof SafeError&&e.status===401)await db('google_calendar_connection?id=eq.true','PATCH',{status:'needs_reconnect'});throw e;}
 if(t.refresh_token)await db('google_calendar_connection?id=eq.true','PATCH',{refresh_encrypted:await seal(t.refresh_token)});
 const jobs=await db('rpc/fsp_calendar_claim','POST',{});let processed=0;
 for(const job of jobs||[]){
  const filter='google_calendar_jobs?appointment_id=eq.'+job.appointment_id+'&lease_id=eq.'+job.lease_id;
  try{
   const rows=await db('appointments?id=eq.'+job.appointment_id+'&select=id,appointment_date,appointment_time,google_calendar_event_id,google_calendar_id');
   const appt=rows?.[0];if(!appt?.google_calendar_event_id)throw new SafeError('Appointment has no linked Google event');
   await googleEvent(appt,t.access_token);
   await db(filter+'&revision=eq.'+job.revision,'PATCH',{status:'synced',last_error:null,synced_at:new Date().toISOString()});processed++;
  }catch(e){
   const message=e instanceof SafeError?e.message:'Temporary sync error; retry scheduled';
   await db(filter+'&revision=eq.'+job.revision,'PATCH',{status:job.attempts>=8?'error':'pending',last_error:message,available_at:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(job.attempts,7))).toISOString()});
  }finally{await db(filter,'PATCH',{locked_until:null,lease_id:null});}
 }
 return {ok:true,connected:true,processed};
}
async function status(){
 const rows=await db('google_calendar_connection?id=eq.true&select=status,connected_at');
 const jobs=await db('google_calendar_jobs?select=appointment_id,status,last_error,synced_at&order=appointment_id');
 return json({ok:true,configured:!!(CLIENT&&SECRET),connection:rows?.[0]||null,jobs});
}
export async function handle(req){
 const url=new URL(req.url),route=url.pathname.split('/').pop();
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 try{
  if(route==='health'&&req.method==='GET')return json({ok:true,configured:!!(CLIENT&&SECRET)});
  if(route==='callback'&&req.method==='GET')return await callback(url);
  if(req.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
  if(route==='worker'){
   const supplied=req.headers.get('x-calendar-worker-secret');if(!supplied)throw new SafeError('Unauthorized',401);
   const expected=await db('rpc/fsp_calendar_worker_credential','POST',{});
   if(!expected||await digest(supplied)!==await digest(expected))throw new SafeError('Unauthorized',401);
   return json(await runJobs());
  }
  const uid=await owner(req);
  const body=await req.json();
  if(body.action==='start')return await start(uid);
  if(body.action==='status')return await status();
  if(body.action==='sync')return json(await runJobs());
  if(body.action==='retry'){await db('rpc/fsp_calendar_enqueue_all','POST',{});return json(await runJobs());}
  return json({ok:false,error:'Unknown action'},400);
 }catch(e){
  const message=e instanceof SafeError?e.message:'Calendar operation failed. Try again from CRM.';
  if(route==='callback')return new Response(message+'\nReturn to https://futuresecureproviders.com/crm/',{status:e instanceof SafeError?e.status:500,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  return json({ok:false,error:message},e instanceof SafeError?e.status:500);
 }
}
Deno.serve(handle);
