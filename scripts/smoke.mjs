import assert from 'node:assert/strict';
// Existing local servers only. Every write stays inside a fresh fictional session.
const origin = 'http://127.0.0.1:5173';
const page = await globalThis.fetch(origin);
assert.equal(page.status, 200);
assert.match(await page.text(), /設備協力者プール/);
const health = await globalThis.fetch(`${origin}/api/health`);
assert.equal(health.status,200);
assert.deepEqual(await health.json(), { status: 'demo-ready', featuresImplemented: true });
assert.equal(health.headers.get('set-cookie'), null);
let cookie = '';
async function api(path, body, method = body ? 'POST' : 'GET') {
 const response = await globalThis.fetch(`${origin}/api${path}`, {method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? {Cookie:cookie} : {}) }, ...(body ? {body:JSON.stringify(body)} : {})});
 const issued=response.headers.get('set-cookie'); if(issued) cookie=issued.split(';')[0];
 assert.equal(response.ok,true,`${method} ${path}: ${response.status}`);
 return response.status===204 ? undefined : (await response.json()).data;
}
assert.equal((await api('/regions')).length,70);
assert.equal((await api('/partners')).length,10);
const project=await api('/projects',{website:'',name:'架空スモーク',requiredFields:['電気'],workType:'改修',use:'教育施設',region:'13101',floors:2,floorArea:1000,period:{start:'2028-01-01',end:'2028-03-31'},requiredServices:[],orderType:'入札',requireListedLicense:false});
const matching=await api(`/projects/${project.id}/candidates`,{website:''});
assert.ok(matching.derived.requiredServices.includes('現地調査'));
assert.ok(matching.candidates.length>0);
assert.equal((await api('/projects')).length,4);
await api(`/projects/${project.id}`,{website:''},'DELETE');
assert.equal((await api('/projects')).length,3);
globalThis.console.log('Local UI, health, seed, regions, project CRUD and real matching smoke passed.');
