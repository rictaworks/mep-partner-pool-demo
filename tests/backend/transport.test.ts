import {expect,it} from 'vitest';
import {getSession} from '../../src/backend/session';
import {databaseHarness} from './harness';
it('processes expired local transport connections before committing a D1 batch',async()=>{
 const h=await databaseHarness();try{
  await h.db.prepare('SELECT 1 AS n').first();
  // Miniflare's synchronous prepare/bind bridge can block Node beyond workerd's 5s idle timeout.
  // Reproduce that scheduling condition without retries or an extra write.
  const until=performance.now()+6000;
  while(performance.now()<until){ /* intentionally block the host event loop */ }
  try {await getSession(new Request('http://demo.test/api'),h.db);}catch(error){
   console.info('Rows after failed transport:',await h.db.prepare('SELECT COUNT(*) AS n FROM SESSION').first());throw error;
  }
  expect(await h.db.prepare('SELECT COUNT(*) AS n FROM SESSION').first()).toEqual({n:1});
  expect(await h.db.prepare('SELECT COUNT(*) AS n FROM PARTNER').first()).toEqual({n:10});
  expect(await h.db.prepare('SELECT COUNT(*) AS n FROM PROJECT').first()).toEqual({n:3});
 }finally{await h.dispose();}
},30_000);
