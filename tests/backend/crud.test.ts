import {expect,it} from 'vitest';
import {handleApi} from '../../src/backend/index';
import {SAMPLE_PARTNERS,SAMPLE_PROJECTS} from '../../src/backend/seed';
import {databaseHarness} from './harness';
import {getSession} from '../../src/backend/session';
async function json(response:Response):Promise<Record<string,unknown>> {return response.json() as Promise<Record<string,unknown>>;}
it('implements owner-scoped CRUD, server validation and assignment protections in real D1',async()=>{
 const h=await databaseHarness();try{
 const call=(method:string,path:string,body?:unknown,cookie?:string)=>handleApi(new Request(`https://demo.test/api${path}`,{method,headers:{Origin:'https://demo.test','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}),{DB:h.db});
 const initial=await call('GET','/partners'),cookie=initial.headers.get('Set-Cookie')!.split(';')[0]!;
 expect(((await json(initial)).data as unknown[])).toHaveLength(10);
 const input={...SAMPLE_PARTNERS[0]!,code:'NEW01',shortName:"架空' OR 1=1 --",website:''};
 const created=await call('POST','/partners',input,cookie);expect(created.status).toBe(201);const partner=(await json(created)).data as {id:number;revision:number};
 expect((await call('POST','/partners',input,cookie)).status).toBe(409);
 const b=await call('GET','/partners'),other=b.headers.get('Set-Cookie')!.split(';')[0]!;
 for(const method of ['GET','PUT','DELETE'])expect((await call(method,`/partners/${partner.id}`,method==='PUT'?{...input,revision:0}:method==='DELETE'?{website:''}:undefined,other)).status).toBe(404);
 expect((await call('PUT',`/partners/${partner.id}`,{...input,shortName:'架空更新',revision:0},cookie)).status).toBe(200);
 expect((await call('PUT',`/partners/${partner.id}`,{...input,revision:0},cookie)).status).toBe(409);
 const engagement=await call('POST',`/partners/${partner.id}/engagements`,{period:{start:'2026-01-01',end:'2026-01-31'},website:''},cookie);expect(engagement.status).toBe(201);const eid=((await json(engagement)).data as {id:number}).id;
 expect((await call('GET',`/partners/${partner.id}/engagements`,undefined,other)).status).toBe(404);
 expect((await call('DELETE',`/partners/${partner.id}/engagements/${eid}`,{website:''},other)).status).toBe(404);
 expect((await call('DELETE',`/partners/${partner.id}/engagements/${eid}`,{website:''},cookie)).status).toBe(204);
 expect((await call('POST',`/partners/${partner.id}/engagements`,{period:{start:'2026-02-30',end:'2026-03-31'},website:''},cookie)).status).toBe(400);
 const pinput={...SAMPLE_PROJECTS[0]!,name:'架空新案件',website:''};
 const projectResponse=await call('POST','/projects',pinput,cookie);expect(projectResponse.status).toBe(201);const project=(await json(projectResponse)).data as {id:number;revision:number};
 for(const method of ['GET','PUT','DELETE'])expect((await call(method,`/projects/${project.id}`,method==='PUT'?{...pinput,revision:0}:method==='DELETE'?{website:''}:undefined,other)).status).toBe(404);
 expect((await call('PUT',`/projects/${project.id}`,{...pinput,name:'架空変更',revision:0},cookie)).status).toBe(200);
 const s=await getSession(new Request('https://demo.test/api',{headers:{Cookie:cookie}}),h.db);
 await h.db.prepare("INSERT INTO ASSIGNMENT(session_id,project_id,partner_id,request_id,fields,status) VALUES(?,?,?,?,?,'confirmed')").bind(s.owner,project.id,partner.id,'protect','["電気"]').run();
 const assignment=await h.db.prepare('SELECT id FROM ASSIGNMENT WHERE session_id=?').bind(s.owner).first<{id:number}>();
 await h.db.prepare('INSERT INTO ENGAGEMENT(partner_id,session_id,start_date,end_date,assignment_id) VALUES(?,?,?,?,?)').bind(partner.id,s.owner,'2026-11-01','2027-03-31',assignment!.id).run();
 const assigned=await h.db.prepare('SELECT id FROM ENGAGEMENT WHERE assignment_id=? AND session_id=?').bind(assignment!.id,s.owner).first<{id:number}>();
 expect((await call('DELETE',`/partners/${partner.id}/engagements/${assigned!.id}`,{website:''},cookie)).status).toBe(409);
 expect((await call('DELETE',`/partners/${partner.id}`,{website:''},cookie)).status).toBe(409);
 expect((await call('PUT',`/projects/${project.id}`,{...pinput,revision:1},cookie)).status).toBe(409);
 expect((await call('DELETE',`/projects/${project.id}`,{website:''},cookie)).status).toBe(409);
 await h.db.prepare('DELETE FROM ASSIGNMENT WHERE session_id=?').bind(s.owner).run();
 expect((await call('DELETE',`/projects/${project.id}`,{website:''},cookie)).status).toBe(204);
 expect((await call('DELETE',`/partners/${partner.id}`,{website:''},cookie)).status).toBe(204);
 }finally{await h.dispose();}
},30_000);
it('protects pool quotas, child-update rollback and concurrent stale entity updates',async()=>{
 const h=await databaseHarness();try{
 const s=await getSession(new Request('https://demo.test/api'),h.db);
 const {Repository}=await import('../../src/backend/db/repository');const repo=new Repository(h.db);
 const partners=await repo.listPartners(s.owner),first=partners[0]!,second=partners[1]!;
 const {id:removedId,revision:removedRevision,...input}=first;void removedId;void removedRevision;
 await expect(repo.updatePartner(s.owner,first.id,{...input,code:second.code,services:[]},0)).rejects.toMatchObject({status:409});
 expect((await repo.getPartner(s.owner,first.id))?.services).toEqual(first.services);
 const outcomes=await Promise.allSettled([repo.updatePartner(s.owner,first.id,{...input,shortName:'架空並行A'},0),repo.updatePartner(s.owner,first.id,{...input,shortName:'架空並行B'},0)]);
 expect(outcomes.filter(v=>v.status==='fulfilled')).toHaveLength(1);
 await h.db.batch(Array.from({length:90},(_,i)=>h.db.prepare('INSERT INTO PARTNER(session_id,code,short_name,capacity,active) VALUES(?,?,?,?,?)').bind(s.owner,`LIMIT${i}`,'架空上限',0,1)));
 await expect(repo.createPartner(s.owner,{...input,code:'OVERLIMIT'})).rejects.toMatchObject({status:409});
 await h.db.batch(Array.from({length:97},()=>h.db.prepare('INSERT INTO PROJECT(session_id,name,fields,work_type,use,region_code,floors,floor_area,start_date,due_date,order_type,require_listed_license) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(s.owner,'架空上限','["電気"]','新築','公共施設','13101',1,1,'2026-01-01','2026-01-02','入札',0)));
 await expect(repo.createProject(s.owner,SAMPLE_PROJECTS[0]!)).rejects.toMatchObject({status:409});
 await h.db.prepare('WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1000) INSERT INTO ENGAGEMENT(partner_id,session_id,start_date,end_date) SELECT ?,?,?,? FROM n').bind(first.id,s.owner,'2026-01-01','2026-01-02').run();
 await expect(repo.createEngagement(s.owner,first.id,{start:'2026-01-01',end:'2026-01-02'})).rejects.toMatchObject({status:409});
 }finally{await h.dispose();}
},30_000);
