import {expect,it} from 'vitest';
import {Repository} from '../../src/backend/db/repository';
import {SAMPLE_PARTNERS,SAMPLE_PROJECTS} from '../../src/backend/seed';
import {getSession} from '../../src/backend/session';
import {handleApi} from '../../src/backend/index';
import {databaseHarness} from './harness';
async function setup(){const h=await databaseHarness();const s=await getSession(new Request('https://demo.test/api'),h.db);const repo=new Repository(h.db);return {...h,owner:s.owner,repo,cookie:`mep_session=${s.owner}`};}
const office=(code:string,fields:readonly ('電気'|'機械')[],capacity=1)=>({...SAMPLE_PARTNERS[0]!,code,shortName:'架空割当',fields,licenses:['設備設計一級建築士'] as const,regions:['13-all'],capacity});
const project=(name:string,fields:readonly ('電気'|'機械')[])=>({...SAMPLE_PROJECTS[0]!,name,requiredFields:fields});
function call(h:Awaited<ReturnType<typeof setup>>,path:string,body:unknown,method='POST',cookie=h.cookie){return handleApi(new Request(`https://demo.test/api${path}`,{method,headers:{Origin:'https://demo.test','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)}),{DB:h.db});}
async function extract(h:Awaited<ReturnType<typeof setup>>,id:number){const response=await call(h,`/projects/${id}/candidates`,{website:''});expect(response.status).toBe(200);return (await response.json() as {data:{projectRevision:number;candidates:unknown[]}}).data;}
it('revalidates current data, races the final slot and makes same-request replay idempotent',async()=>{
 const h=await setup();try{
 const p=await h.repo.createPartner(h.owner,office('ASSIGN1',['電気'])),a=await h.repo.createProject(h.owner,project('架空競合A',['電気'])),b=await h.repo.createProject(h.owner,project('架空競合B',['電気']));
 const ac=await extract(h,a.id),bc=await extract(h,b.id);
 const request=(rev:number,key:string)=>({website:'',projectRevision:rev,requestId:key,selections:[{partnerId:p.id,fields:['電気']}]});
 const outcomes=await Promise.all([call(h,`/projects/${a.id}/assignments`,request(ac.projectRevision,'a')),call(h,`/projects/${b.id}/assignments`,request(bc.projectRevision,'b'))]);expect(outcomes.map(v=>v.status).sort()).toEqual([200,409]);
 expect(await h.repo.listEngagements(h.owner,p.id)).toHaveLength(1);
 const winner=outcomes[0]!.status===200?a:b,key=winner.id===a.id?'a':'b',rev=winner.id===a.id?ac.projectRevision:bc.projectRevision;
 expect((await call(h,`/projects/${winner.id}/assignments`,request(rev,key))).status).toBe(200);expect(await h.repo.listEngagements(h.owner,p.id)).toHaveLength(1);
 const assignment=(await h.repo.getAssignments(h.owner,winner.id))[0]!;
 expect((await call(h,`/projects/${winner.id}/assignments/${assignment.id}`,{website:'',requestId:'cancel'},'DELETE')).status).toBe(200);
 expect((await call(h,`/projects/${winner.id}/assignments/${assignment.id}`,{website:'',requestId:'cancel'},'DELETE')).status).toBe(200);
 expect((await call(h,`/projects/${winner.id}/assignments`,request(rev,key))).status).toBe(200);expect(await h.repo.listEngagements(h.owner,p.id)).toHaveLength(0);
 const stale=await extract(h,a.id);await h.repo.updatePartner(h.owner,p.id,{...office('ASSIGN1',['電気']),active:false},p.revision);
 expect((await call(h,`/projects/${a.id}/assignments`,request(stale.projectRevision,'stale'))).status).toBe(409);
 }finally{await h.dispose();}
},30_000);
it('supports partial completion with one dual-field load and preserves manual loads on cancellation',async()=>{
 const h=await setup();try{
 const p=await h.repo.createPartner(h.owner,office('DUAL',['電気','機械'],3)),a=await h.repo.createProject(h.owner,project('架空一部',['電気','機械']));
 await h.repo.createEngagement(h.owner,p.id,a.period);const first=await extract(h,a.id);
 const body=(rev:number,key:string,fields:string[])=>({website:'',projectRevision:rev,requestId:key,selections:[{partnerId:p.id,fields}]});
 expect((await call(h,`/projects/${a.id}/assignments`,body(first.projectRevision,'part',['電気']))).status).toBe(200);expect((await h.repo.getProject(h.owner,a.id))?.state).toBe('partial');
 const next=await extract(h,a.id);expect((await call(h,`/projects/${a.id}/assignments`,body(next.projectRevision,'finish',['機械']))).status).toBe(200);expect((await h.repo.getProject(h.owner,a.id))?.state).toBe('assigned');
 expect(await h.repo.listEngagements(h.owner,p.id)).toHaveLength(2);
 const assignment=(await h.repo.getAssignments(h.owner,a.id))[0]!;expect(assignment.fields).toHaveLength(2);
 const other=await getSession(new Request('https://demo.test/api'),h.db),cookie=`mep_session=${other.owner}`;
 expect((await call(h,`/projects/${a.id}/candidates`,{website:''},'POST',cookie)).status).toBe(404);
 expect((await call(h,`/projects/${a.id}/assignments`,body(next.projectRevision,'foreign',['機械']),'POST',cookie)).status).toBe(404);
 expect((await call(h,`/projects/${a.id}/assignments/${assignment.id}`,{website:'',requestId:'foreign-cancel'},'DELETE',cookie)).status).toBe(404);
 expect((await call(h,`/projects/${a.id}/assignments/${assignment.id}`,{website:'',requestId:'cancel'},'DELETE')).status).toBe(200);
 expect(await h.repo.listEngagements(h.owner,p.id)).toHaveLength(1);expect((await h.repo.getProject(h.owner,a.id))?.state).toBe('candidates');
 }finally{await h.dispose();}
},30_000);
it('rolls back both offices if pair persistence fails and handles concurrent same-request replay',async()=>{
 const h=await setup();try{
 const e=await h.repo.createPartner(h.owner,office('ELECTRIC',['電気'],2)),m=await h.repo.createPartner(h.owner,office('MECHANICAL',['機械'],2)),a=await h.repo.createProject(h.owner,project('架空組',['電気','機械']));
 const c=await extract(h,a.id),body={website:'',projectRevision:c.projectRevision,requestId:'pair',selections:[{partnerId:e.id,fields:['電気']},{partnerId:m.id,fields:['機械']}]};
 await h.db.prepare(`CREATE TRIGGER TEST_PAIR_FAILURE BEFORE INSERT ON ENGAGEMENT WHEN NEW.partner_id=${m.id} BEGIN SELECT RAISE(ABORT,'forced pair failure'); END`).run();
 expect((await call(h,`/projects/${a.id}/assignments`,body)).status).toBe(500);expect(await h.repo.getAssignments(h.owner,a.id)).toHaveLength(0);expect(await h.repo.listEngagements(h.owner,e.id)).toHaveLength(0);
 await h.db.prepare('DROP TRIGGER TEST_PAIR_FAILURE').run();const responses=await Promise.all([call(h,`/projects/${a.id}/assignments`,body),call(h,`/projects/${a.id}/assignments`,body)]);expect(responses.map(r=>r.status)).toEqual([200,200]);
 expect(await h.repo.getAssignments(h.owner,a.id)).toHaveLength(2);expect(await h.repo.listEngagements(h.owner,e.id)).toHaveLength(1);expect(await h.repo.listEngagements(h.owner,m.id)).toHaveLength(1);
 expect((await call(h,`/projects/${a.id}/assignments`,{...body,selections:[{partnerId:e.id,fields:['電気']}]})).status).toBe(409);
 }finally{await h.dispose();}
},30_000);
it('rejects changed license/region/capacity/period, invalid selectors and uncompletable partial roles',async()=>{
 const h=await setup();try{
 const input=office('CHANGES',['電気']),p=await h.repo.createPartner(h.owner,input),a=await h.repo.createProject(h.owner,project('架空変更',['電気']));
 for(const [i,change] of [{licenses:[]},{regions:['14-all']},{capacity:0}].entries()){
 const before=await extract(h,a.id),current=await h.repo.getPartner(h.owner,p.id);await h.repo.updatePartner(h.owner,p.id,{...input,...change},current!.revision);
 expect((await call(h,`/projects/${a.id}/assignments`,{website:'',requestId:`change${i}`,projectRevision:before.projectRevision,selections:[{partnerId:p.id,fields:['電気']}]})).status).toBe(409);
 const after=await h.repo.getPartner(h.owner,p.id);await h.repo.updatePartner(h.owner,p.id,input,after!.revision);
 }
 const before=await extract(h,a.id),current=await h.repo.getProject(h.owner,a.id);await h.repo.updateProject(h.owner,a.id,{...project('架空変更',['電気']),period:{start:'2027-01-01',end:'2027-06-01'}},current!.revision);
 const body={website:'',requestId:'period',projectRevision:before.projectRevision,selections:[{partnerId:p.id,fields:['電気']}]};expect((await call(h,`/projects/${a.id}/assignments`,body)).status).toBe(409);
 for(const changed of [{...body,rank:1},{...body,selections:[{partnerId:p.id,fields:['unknown']}]},{...body,selections:[{partnerId:1.1,fields:['電気']}]},{...body,selections:[{partnerId:p.id,fields:['電気']},{partnerId:p.id,fields:['機械']}]},{...body,selections:[{partnerId:p.id,fields:['電気'],owner:'spoof'}]}])expect((await call(h,`/projects/${a.id}/assignments`,changed)).status).toBe(400);
 const foreign=await getSession(new Request('https://demo.test/api'),h.db),foreignOffice=(await h.repo.listPartners(foreign.owner))[0]!;const c=await extract(h,a.id);
 expect((await call(h,`/projects/${a.id}/assignments`,{...body,projectRevision:c.projectRevision,requestId:'foreign-office',selections:[{partnerId:foreignOffice.id,fields:['電気']}]})).status).toBe(404);
 const dual=await h.repo.createProject(h.owner,project('架空不足',['電気','機械']));
 // Isolate the selected office; no mechanical completion may be fabricated.
 await h.db.prepare('UPDATE PARTNER SET active=0 WHERE session_id=? AND id<>?').bind(h.owner,p.id).run();
 const dc=await extract(h,dual.id);expect((await call(h,`/projects/${dual.id}/assignments`,{...body,projectRevision:dc.projectRevision,requestId:'incomplete'})).status).toBe(409);
 }finally{await h.dispose();}
},30_000);
it('allows cancellation at the request quota and never mutates canceled replays with fresh keys',async()=>{
 const h=await setup();try{
 const p=await h.repo.createPartner(h.owner,office('QUOTACANCEL',['電気'])),a=await h.repo.createProject(h.owner,project('架空取消上限',['電気'])),c=await extract(h,a.id);
 const body={website:'',requestId:'confirm',projectRevision:c.projectRevision,selections:[{partnerId:p.id,fields:['電気']}]};expect((await call(h,`/projects/${a.id}/assignments`,body)).status).toBe(200);
 const assignment=(await h.repo.getAssignments(h.owner,a.id))[0]!;
 await h.db.prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1999) INSERT INTO ASSIGNMENT_REQUEST(session_id,project_id,request_id,operation,fingerprint) SELECT ?,?,'quota'||i,'confirm','{}' FROM n").bind(h.owner,a.id).run();
 expect((await call(h,`/projects/${a.id}/assignments/${assignment.id}`,{website:'',requestId:'cancel-at-quota'},'DELETE')).status).toBe(200);expect(await h.repo.listEngagements(h.owner,p.id)).toHaveLength(0);
 const before=await h.repo.getProject(h.owner,a.id);for(let i=0;i<3;i++)expect((await call(h,`/projects/${a.id}/assignments/${assignment.id}`,{website:'',requestId:`fresh${i}`},'DELETE')).status).toBe(200);
 expect((await h.repo.getProject(h.owner,a.id))?.revision).toBe(before!.revision);expect((await h.db.prepare('SELECT COUNT(*) AS n FROM ASSIGNMENT_REQUEST WHERE session_id=?').bind(h.owner).first<{n:number}>())?.n).toBe(2001);
 }finally{await h.dispose();}
},30_000);
it('accepts a valid pair outside the displayed top20 and pins partial roles before ranking',async()=>{
 const h=await setup();try{
 const {partnerInsert}=await import('../../src/backend/seed');
 const inputs=[...Array.from({length:5},(_,i)=>({...office(`TOP_E${i}`,['電気'],3),experience:{'教育施設':{'新築':50,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':0,'改修':0}}})),...Array.from({length:5},(_,i)=>({...office(`TOP_M${i}`,['機械'],3),experience:{'教育施設':{'新築':50,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':0,'改修':0}}}))];
 await h.repo.guardedBatch(h.owner,await h.repo.revision(h.owner),inputs.flatMap(p=>partnerInsert(h.db,h.owner,p)));
 const e=await h.repo.createPartner(h.owner,{...office('ZZ_E',['電気'],2),experience:{'教育施設':{'新築':0,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':0,'改修':0}}}),m=await h.repo.createPartner(h.owner,{...office('ZZ_M',['機械'],2),experience:{'教育施設':{'新築':0,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':0,'改修':0}}}),a=await h.repo.createProject(h.owner,project('架空上位外',['電気','機械']));
 const first=await extract(h,a.id);expect(first.candidates).not.toContainEqual(expect.objectContaining({electrical:e.code,mechanical:m.code}));
 expect((await call(h,`/projects/${a.id}/assignments`,{website:'',requestId:'outside20',projectRevision:first.projectRevision,selections:[{partnerId:e.id,fields:['電気']},{partnerId:m.id,fields:['機械']}]})).status).toBe(200);
 const b=await h.repo.createProject(h.owner,project('架空担当固定',['電気','機械'])),bc=await extract(h,b.id);
 expect((await call(h,`/projects/${b.id}/assignments`,{website:'',requestId:'pin',projectRevision:bc.projectRevision,selections:[{partnerId:e.id,fields:['電気']}]})).status).toBe(200);
 const pinned=await extract(h,b.id);expect(pinned.candidates.length).toBeGreaterThan(0);expect(pinned.candidates.every(c=>(c as {electrical:string}).electrical===e.code)).toBe(true);
 }finally{await h.dispose();}
},30_000);
