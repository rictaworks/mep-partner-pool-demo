import {describe,expect,it} from 'vitest';
import worker from '../src/backend/index';
import type {Env} from '../src/backend/index';
const unbound={} as Env;
describe('HTTP adapter availability',()=>{
 it('reports CRUD readiness without claiming complete features or creating a session',async()=>{
 const response=await worker.fetch(new Request('http://localhost/api/health'),unbound);
 expect(response.status).toBe(200);expect(await response.json()).toEqual({status:'backend-ready',featuresImplemented:false});expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('set-cookie')).toBeNull();
 });
 it('returns a safe error when persistence binding is unavailable',async()=>{
 const response=await worker.fetch(new Request('http://localhost/api/partners'),unbound);expect(response.status).toBe(500);expect(await response.json()).toMatchObject({error:{code:'INTERNAL'}});expect(response.headers.get('set-cookie')).toBeNull();
 });
 it.each(['PUT','PATCH','DELETE','OPTIONS'])('rejects unsupported collection method %s',async method=>{const response=await worker.fetch(new Request('http://localhost/api/partners',{method}),unbound);expect(response.status).toBe(405);});
 it('does not treat POST to health as success',async()=>{expect((await worker.fetch(new Request('http://localhost/api/health',{method:'POST'}),unbound)).status).toBe(405);});
 it('returns404 outside API namespace',async()=>{expect((await worker.fetch(new Request('http://localhost/apiculture'),unbound)).status).toBe(404);});
});
