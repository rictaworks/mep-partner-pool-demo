import { expect,it } from 'vitest';
import { getSession } from '../../src/backend/session';
import { Repository } from '../../src/backend/db/repository';
import { databaseHarness } from './harness';
import { SAMPLE_PROJECTS, projectInsert } from '../../src/backend/seed';
it('atomically seeds 10 fictional partners and 3 projects once per valid session',async()=>{
 const h=await databaseHarness();try{
 const s=await getSession(new Request('http://demo.test/api/partners'),h.db);
 const r=new Repository(h.db);
 expect(await r.listPartners(s.owner)).toHaveLength(10);expect(await r.listProjects(s.owner)).toHaveLength(3);
 const requests=Array.from({length:4},()=>getSession(new Request('http://demo.test/api/partners',{headers:{Cookie:`mep_session=${s.owner}`}}),h.db));
 const sessions=await Promise.all(requests);expect(sessions.every(v=>v.owner===s.owner)).toBe(true);
 expect(await r.listPartners(s.owner)).toHaveLength(10);
 const revision=await r.revision(s.owner);
 await r.guardedBatch(s.owner,revision,projectInsert(h.db,s.owner,{...SAMPLE_PROJECTS[0]!,name:'架空追加計画',requiredServices:['積算','現地調査','定例会出席']}));
 const added=(await r.listProjects(s.owner)).find(p=>p.name==='架空追加計画');expect(added?.requiredServices).toHaveLength(3);
 const before=await h.db.prepare('SELECT COUNT(*) AS n FROM SESSION').first<{n:number}>();
 await h.db.prepare("CREATE TRIGGER TEST_SEED_FAILURE BEFORE INSERT ON PROJECT BEGIN SELECT RAISE(ABORT,'forced seed failure'); END").run();
 await expect(getSession(new Request('http://demo.test/api'),h.db)).rejects.toThrow();
 expect(await h.db.prepare('SELECT COUNT(*) AS n FROM SESSION').first()).toEqual(before);
 expect(await h.db.prepare('SELECT COUNT(*) AS n FROM PARTNER').first()).toEqual({n:10});
 expect(await h.db.prepare('SELECT * FROM REGION_MASTER').all()).toMatchObject({results:expect.arrayContaining([expect.objectContaining({region_code:'13-all'})])});
 }finally{await h.dispose();}
},30_000);
