import {checkMutationRequest} from '../../src/backend/session';
import {expect,it} from 'vitest';
import {handleApi} from '../../src/backend/index';
import {databaseHarness} from './harness';
import {SAMPLE_PARTNERS} from '../../src/backend/seed';
it('rejects malicious and malformed requests before saving and hides internal failures',async()=>{
 const h=await databaseHarness();try{
 const call=(body:string,headers:Record<string,string>={},path='/api/partners',method='POST')=>handleApi(new Request(`https://demo.test${path}`,{method,headers:{Origin:'https://demo.test','Content-Type':'application/json',...headers},body}),{DB:h.db});
 expect((await call('{')).status).toBe(400);
 expect((await call('{}',{Origin:'https://evil.test'})).status).toBe(403);
 expect((await call('{}',{'Content-Type':'text/plain'})).status).toBe(415);
 const bot=await call(JSON.stringify({...SAMPLE_PARTNERS[0]!,website:'bot'}));expect(bot.status).toBe(204);expect(bot.headers.get('Set-Cookie')).toBeNull();
 expect((await h.db.prepare('SELECT COUNT(*) AS n FROM SESSION').first<{n:number}>())?.n).toBe(0);
 expect((await call('x'.repeat(32769))).status).toBe(413);
 const input={...SAMPLE_PARTNERS[0]!,website:''};
 for(const body of [{...input,fields:[]},{...input,owner:'spoof'},{...input,licenses:['unknown']},{...input,capacity:1.1}])expect((await call(JSON.stringify(body))).status).toBe(400);
 expect((await call(JSON.stringify({website:''}),{},'/api/partners/99999999999999999999','DELETE')).status).toBe(400);
 expect((await handleApi(new Request('https://demo.test/api/partners?owner=spoof'),{DB:h.db})).status).toBe(400);
 expect((await handleApi(new Request('https://demo.test/api/regions'),{DB:h.db})).status).toBe(200);
 await h.db.prepare('DROP TABLE SESSION').run();
 const failure=await handleApi(new Request('https://demo.test/api/partners'),{DB:h.db});expect(failure.status).toBe(500);expect(await failure.text()).not.toMatch(/SQL|SESSION|stack|D1_ERROR/);
 }finally{await h.dispose();}
},30_000);
it('enforces streamed body bytes and rejects invalid nested properties without a session',async()=>{
 const fake={} as Parameters<typeof handleApi>[1];
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(20_000));controller.enqueue(new Uint8Array(20_000));controller.close();}});
 const request=new Request('https://demo.test/api/partners',{method:'POST',headers:{Origin:'https://demo.test','Content-Type':'application/json','Content-Length':'1'},body:stream,duplex:'half'} as RequestInit);
 const response=await handleApi(request,fake);expect(response.status).toBe(413);expect(response.headers.get('set-cookie')).toBeNull();
 const invalid=new Request('https://demo.test/api/partners',{method:'POST',headers:{Origin:'https://demo.test','Content-Type':'application/json'},body:new Uint8Array([0xff])});expect((await handleApi(invalid,fake)).status).toBe(400);
 for(const body of ['null','[]','{}','{"website":42}']){const result=await handleApi(new Request('https://demo.test/api/partners',{method:'POST',headers:{Origin:'https://demo.test','Content-Type':'application/json'},body}),fake);expect(result.status).toBe(400);expect(result.headers.get('set-cookie')).toBeNull();}
});
it('uses an explicitly configured frontend origin behind the local proxy',()=>{
 const req=new Request('http://127.0.0.1:8787/api/partners',{method:'POST',headers:{Origin:'http://127.0.0.1:5173','Content-Type':'application/json'}});
 expect(checkMutationRequest(req,'http://127.0.0.1:5173')).toBeNull();
 const attack=new Request('http://127.0.0.1:8787/api/partners',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'}});
 expect(checkMutationRequest(attack,'http://127.0.0.1:5173')?.status).toBe(403);
});
