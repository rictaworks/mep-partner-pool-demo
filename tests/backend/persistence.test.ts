import {expect,it} from 'vitest';
import {getSession} from '../../src/backend/session';
import {Repository} from '../../src/backend/db/repository';
import {databaseHarness} from './harness';
it('scopes reads and enforces composite owner foreign keys and atomic revision guards',async()=>{
 const h=await databaseHarness();try{
 const a=await getSession(new Request('http://demo.test/api'),h.db),b=await getSession(new Request('http://demo.test/api'),h.db);
 const r=new Repository(h.db),partner=(await r.listPartners(a.owner))[0]!;
 expect(await r.getPartner(b.owner,partner.id)).toBeNull();
 await expect(h.db.prepare('INSERT INTO PARTNER_FIELD(partner_id,session_id,field) VALUES(?,?,?)').bind(partner.id,b.owner,'電気').run()).rejects.toThrow();
 const version=await r.revision(a.owner);
 const statement=h.db.prepare('UPDATE PARTNER SET short_name=? WHERE session_id=? AND id=?').bind('変更',a.owner,partner.id);
 await r.guardedBatch(a.owner,version,[statement]);
 await expect(r.guardedBatch(a.owner,version,[h.db.prepare('UPDATE PARTNER SET short_name=? WHERE session_id=? AND id=?').bind('stale',a.owner,partner.id)])).rejects.toThrow();
 expect((await r.getPartner(a.owner,partner.id))?.shortName).toBe('変更');
 const projects=await r.listProjects(a.owner), project=projects[0]!, other=projects[1]!;
 expect(await r.getProject(b.owner,project.id)).toBeNull();
 await expect(h.db.prepare('INSERT INTO PROJECT_SERVICE(project_id,session_id,service) VALUES(?,?,?)').bind(project.id,b.owner,'積算').run()).rejects.toThrow();
 await expect(h.db.prepare('INSERT INTO ENGAGEMENT(partner_id,session_id,start_date,end_date) VALUES(?,?,?,?)').bind(partner.id,b.owner,'2026-01-01','2026-02-01').run()).rejects.toThrow();
 await expect(h.db.prepare("INSERT INTO ASSIGNMENT(session_id,project_id,partner_id,request_id,fields,status) VALUES(?,?,?,?,?,'confirmed')").bind(b.owner,project.id,partner.id,'cross','["電気"]').run()).rejects.toThrow();
 await h.db.prepare("INSERT INTO ASSIGNMENT(session_id,project_id,partner_id,request_id,fields,status) VALUES(?,?,?,?,?,'confirmed')").bind(a.owner,project.id,partner.id,'valid','["電気"]').run();
 const assignment=(await r.getAssignments(a.owner,project.id))[0]!;
 await h.db.prepare('INSERT INTO ASSIGNMENT_FIELD(assignment_id,session_id,project_id,field) VALUES(?,?,?,?)').bind(assignment.id,a.owner,project.id,'電気').run();
 await expect(h.db.prepare('UPDATE ASSIGNMENT_FIELD SET project_id=? WHERE assignment_id=? AND session_id=?').bind(other.id,assignment.id,a.owner).run()).rejects.toThrow();
 await h.db.prepare('INSERT INTO ENGAGEMENT(partner_id,session_id,start_date,end_date,assignment_id) VALUES(?,?,?,?,?)').bind(partner.id,a.owner,'2026-01-01','2026-02-01',assignment.id).run();
 expect(await r.listEngagements(b.owner,partner.id)).toEqual([]);expect(await r.getAssignments(b.owner,project.id)).toEqual([]);
 expect(await r.listEngagements(a.owner,partner.id)).toHaveLength(1);
 const current=await r.revision(a.owner);
 await expect(r.guardedBatch(a.owner,current,[h.db.prepare('UPDATE PARTNER SET short_name=? WHERE id=? AND session_id=?').bind('rollback',partner.id,a.owner),h.db.prepare('INSERT INTO ENGAGEMENT(partner_id,session_id,start_date,end_date) VALUES(?,?,?,?)').bind(partner.id,b.owner,'2026-01-01','2026-02-01')])).rejects.toThrow();
 expect((await r.getPartner(a.owner,partner.id))?.shortName).toBe('変更');expect(await r.revision(a.owner)).toBe(current);
 const parallel=await Promise.allSettled([r.guardedBatch(a.owner,current,[]),r.guardedBatch(a.owner,current,[])]);expect(parallel.filter(v=>v.status==='fulfilled')).toHaveLength(1);
 await h.db.prepare('DELETE FROM ASSIGNMENT WHERE session_id=?').bind(a.owner).run();expect(await r.listEngagements(a.owner)).toEqual([]);
 await h.db.prepare('DELETE FROM SESSION WHERE session_id=?').bind(a.owner).run();
 expect(await r.listPartners(a.owner)).toEqual([]);expect(await r.listProjects(a.owner)).toEqual([]);expect(await r.listPartners(b.owner)).toHaveLength(10);
 await expect(r.guardedBatch(a.owner,0,[])).rejects.toThrow();
 expect((await h.db.prepare('SELECT COUNT(*) AS n FROM REGION_MASTER').first<{n:number}>())?.n).toBe(70);

 }finally{await h.dispose();}
},30_000);
