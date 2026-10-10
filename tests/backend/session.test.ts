import { expect, it } from 'vitest';
import { getSession, checkMutationRequest } from '../../src/backend/session';
import { databaseHarness } from './harness';
it('creates opaque server-owned sessions and never adopts forged cookies',async()=>{
 const h=await databaseHarness();try {
 const a=await getSession(new Request('https://demo.test/api/partners'),h.db);
 const b=await getSession(new Request('https://demo.test/api/partners',{headers:{Cookie:'mep_session=attacker'}}),h.db);
 expect(a.owner).not.toBe(b.owner);expect(a.owner).toMatch(/^[a-f0-9]{64}$/);expect(a.cookie).toContain('HttpOnly');expect(a.cookie).toContain('SameSite=Lax');expect(a.cookie).toContain('Secure');
 const again=await getSession(new Request('https://demo.test/api/partners',{headers:{Cookie:`mep_session=${a.owner}`}}),h.db);
 expect(again.owner).toBe(a.owner);expect(again.cookie).toBeNull();
 const duplicate=await getSession(new Request('https://demo.test/api',{headers:{Cookie:`mep_session=${a.owner}; mep_session=${a.owner}`}}),h.db);expect(duplicate.owner).not.toBe(a.owner);
 const unknown='a'.repeat(64);const forged=await getSession(new Request('https://demo.test/api',{headers:{Cookie:`mep_session=${unknown}`}}),h.db);expect(forged.owner).not.toBe(unknown);
 const expired=await getSession(new Request('http://demo.test/api',{headers:{Cookie:`mep_session=${a.owner}`}}),h.db,Date.now()+86_401_000);expect(expired.owner).not.toBe(a.owner);expect(expired.cookie).not.toContain('Secure');
 await h.db.prepare('DROP TABLE PARTNER_LICENSE').run();await expect(getSession(new Request('https://demo.test/api'),h.db)).rejects.toThrow();

 }finally{await h.dispose();}
},30_000);
it('rejects cross-origin, cross-site and non JSON mutations',()=>{
 expect(checkMutationRequest(new Request('https://demo.test/api/partners',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'}}))).not.toBeNull();
 expect(checkMutationRequest(new Request('https://demo.test/api/partners',{method:'POST',headers:{Origin:'https://demo.test','Sec-Fetch-Site':'cross-site','Content-Type':'application/json'}}))).not.toBeNull();
 expect(checkMutationRequest(new Request('https://demo.test/api/partners',{method:'POST',headers:{Origin:'https://demo.test','Content-Type':'text/plain'}}))).not.toBeNull();
 expect(checkMutationRequest(new Request('https://demo.test/api/partners',{method:'POST',headers:{Origin:'https://demo.test','Content-Type':'application/json'}}))).toBeNull();
 expect(checkMutationRequest(new Request('https://demo.test/api/partners',{method:'POST',headers:{'Content-Type':'application/json'}}))).not.toBeNull();
});
