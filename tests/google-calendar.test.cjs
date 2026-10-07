const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
let handler,requests=[],mock;
const context={Deno:{env:{get:k=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'}[k])},serve:h=>handler=h},crypto:webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Response,Request,AbortSignal,btoa,atob,fetch:async(u,o)=>{requests.push([u,o]);return mock(u,o)}};
vm.createContext(context);
vm.runInContext(fs.readFileSync('supabase/functions/google-calendar-oauth/index.ts','utf8').replaceAll('export ',''),context);
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
(async()=>{
 const p=context.eventPatch({appointment_date:'2026-10-08',appointment_time:'19:30'},{start:{dateTime:'2026-10-07T10:00:00+05:30'},end:{dateTime:'2026-10-07T10:45:00+05:30'}});
 assert.equal(p.start.dateTime,'2026-10-08T14:00:00.000Z');assert.equal(p.end.dateTime,'2026-10-08T14:45:00.000Z');
 for(const e of [{status:'cancelled'},{recurringEventId:'abc'},{start:{date:'2026-10-07'},end:{date:'2026-10-08'}}])assert.throws(()=>context.eventPatch({appointment_date:'2026-10-08',appointment_time:'19:30'},e));
 const encrypted=await context.seal('refresh-token');assert(!encrypted.includes('refresh-token'));assert.equal(await context.unseal(encrypted),'refresh-token');
 for(const path of ['', '/worker']){const r=await handler(new Request('https://test/google-calendar-oauth'+path,{method:'POST',body:'{"action":"start"}'}));assert.equal(r.status,401);}
 assert.equal(requests.length,0);
 assert.equal((await handler(new Request('https://test/callback?state=bad'))).status,400);
 mock=()=>response([]);assert.equal((await handler(new Request('https://test/callback?state='+'a'.repeat(43)+'&code=used'))).status,400);
 mock=()=>response({id:'not-admin'});assert.equal((await handler(new Request('https://test/oauth',{method:'POST',headers:{Authorization:'Bearer test'},body:'{"action":"start"}'}))).status,403);
 requests=[];mock=(u,o)=>response(o?.method==='PATCH'?{id:'same-id',start:p.start,end:p.end}:{id:'same-id',etag:'"version"',start:{dateTime:'2026-10-07T10:00:00+05:30'},end:{dateTime:'2026-10-07T10:45:00+05:30'}});
 await context.googleEvent({appointment_date:'2026-10-08',appointment_time:'19:30',google_calendar_event_id:'same-id'},'access');
 assert.equal(requests.length,2);assert.equal(requests[1][1].method,'PATCH');assert.equal(requests[1][1].headers['If-Match'],'"version"');assert(requests.every(([u])=>u.includes('/events/same-id')));assert.deepEqual(Object.keys(JSON.parse(requests[1][1].body)),['start','end']);
 requests=[];mock=()=>response({},404);await assert.rejects(()=>context.googleEvent({google_calendar_event_id:'missing'},'access'));assert.equal(requests.length,1);
 console.log('PASS: timezone, duration, encryption, authorization, invalid/replayed state, same-event PATCH and missing-event protection');
})().catch(e=>{console.error(e);process.exitCode=1});
