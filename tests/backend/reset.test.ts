import {readFileSync} from 'node:fs';
import worker, {handleApi} from '../../src/backend/index';
import { expect, it } from 'vitest';
import { resetDatabase, scheduledReset, RESET_CRON } from '../../src/backend/reset';
import { getSession } from '../../src/backend/session';
import { Repository } from '../../src/backend/db/repository';
import { databaseHarness } from './harness';
it('resets all owners atomically, preserves master, rotates old cookies and tolerates repeats',async()=>{
 const h=await databaseHarness();try{
 const a=await getSession(new Request('http://demo.test/api'),h.db),b=await getSession(new Request('http://demo.test/api'),h.db);
 const repo=new Repository(h.db),p=(await repo.listPartners(a.owner))[0]!,project=(await repo.listProjects(a.owner))[0]!;
 await h.db.prepare("INSERT INTO ASSIGNMENT(session_id,project_id,partner_id,request_id,fields,status) VALUES(?,?,?,?,?,'confirmed')").bind(a.owner,project.id,p.id,'test-reset','["電気"]').run();
 const assignment=(await repo.getAssignments(a.owner,project.id))[0]!;
 await h.db.prepare('INSERT INTO ASSIGNMENT_FIELD(assignment_id,session_id,project_id,field) VALUES(?,?,?,?)').bind(assignment.id,a.owner,project.id,'電気').run();
 await h.db.prepare('INSERT INTO ENGAGEMENT(partner_id,session_id,start_date,end_date,assignment_id) VALUES(?,?,?,?,?)').bind(p.id,a.owner,'2026-01-01','2026-02-01',assignment.id).run();
 await repo.createEngagement(a.owner,p.id,{start:'2026-03-01',end:'2026-03-10'});
 await h.db.prepare("INSERT INTO ASSIGNMENT_REQUEST(session_id,project_id,request_id,operation,fingerprint) VALUES(?,?,?,'confirm',?)").bind(a.owner,project.id,'reset-history','test-fingerprint').run();
 await h.db.prepare("CREATE TRIGGER RESET_FAIL BEFORE DELETE ON SESSION BEGIN SELECT RAISE(ABORT,'reset failed'); END").run();
 await expect(resetDatabase(h.db)).rejects.toThrow();
 expect(await repo.getAssignments(a.owner,project.id)).toHaveLength(1);expect(await repo.listPartners(b.owner)).toHaveLength(10);
 expect(await repo.listEngagements(a.owner,p.id)).toHaveLength(2);
 expect(await h.db.prepare('SELECT COUNT(*) AS n FROM ASSIGNMENT_REQUEST').first()).toEqual({n:1});
 await h.db.prepare('DROP TRIGGER RESET_FAIL').run();
 const publicReset=await handleApi(new Request('http://demo.test/api/reset',{method:'POST'}),{DB:h.db});
 expect(publicReset.status).toBe(404);expect(await repo.listPartners(a.owner)).toHaveLength(10);
 await expect(scheduledReset({cron:'* * * * *'} as ScheduledController,{DB:h.db})).rejects.toThrow();
 const revision=await repo.revision(a.owner);
 const races=await Promise.allSettled([resetDatabase(h.db),repo.guardedBatch(a.owner,revision,[h.db.prepare('UPDATE PARTNER SET short_name=? WHERE session_id=?').bind('old-data',a.owner)])]);
 expect(races[0]?.status).toBe('fulfilled');
 expect(await repo.listPartners(a.owner)).toEqual([]);expect(await repo.listProjects(b.owner)).toEqual([]);
 await scheduledReset({cron:RESET_CRON} as ScheduledController,{DB:h.db});
 const tables=(await h.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name!='REGION_MASTER'").all<{name:string}>()).results;
 for(const table of tables){expect(await h.db.prepare(`SELECT COUNT(*) AS n FROM ${table.name}`).first()).toEqual({n:0});}
 expect(await h.db.prepare('SELECT COUNT(*) AS n FROM REGION_MASTER').first()).toEqual({n:70});
 const fresh=await getSession(new Request('http://demo.test/api',{headers:{Cookie:`mep_session=${a.owner}`}}),h.db);
 expect(fresh.owner).not.toBe(a.owner);expect(await repo.listPartners(fresh.owner)).toHaveLength(10);expect(await repo.listProjects(fresh.owner)).toHaveLength(3);
 const parallel=await Promise.allSettled([getSession(new Request('http://demo.test/api'),h.db),resetDatabase(h.db)]);
 expect(parallel.every(x=>x.status==='fulfilled')).toBe(true);expect(await repo.listPartners(a.owner)).toEqual([]);
 const seeded=parallel[0]!;if(seeded.status==='fulfilled'){
  const exists=await h.db.prepare('SELECT session_id FROM SESSION WHERE session_id=?').bind(seeded.value.owner).first();
  expect(await repo.listPartners(seeded.value.owner)).toHaveLength(exists?10:0);
  expect(await repo.listProjects(seeded.value.owner)).toHaveLength(exists?3:0);
 }
 for(const table of tables){expect(await h.db.prepare(`SELECT COUNT(*) AS n FROM ${table.name} WHERE session_id NOT IN (SELECT session_id FROM SESSION)`).first()).toEqual({n:0});}
 expect(RESET_CRON).toBe('0 18 * * *');
 }finally{await h.dispose();}
},30_000);

it('exports only the scheduled reset handler and the UTC18 local cron',()=>{
 expect(worker).toHaveProperty('scheduled',scheduledReset);
 expect(readFileSync('wrangler.local.jsonc','utf8')).toContain('"crons":["0 18 * * *"]');
});
