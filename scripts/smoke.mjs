import assert from 'node:assert/strict';

// Run against the two already-running local development servers; no subprocess runner.
const origin = 'http://127.0.0.1:5173';
const page = await globalThis.fetch(origin);
assert.equal(page.status, 200);
assert.match(await page.text(), /開発準備のみ・機能未実装/);
const health = await globalThis.fetch(`${origin}/api/health`);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: 'setup-only', featuresImplemented: false });
assert.equal(health.headers.get('set-cookie'), null);
const feature = await globalThis.fetch(`${origin}/api/partners`, { method: 'POST' });
assert.equal(feature.status, 501);
assert.equal((await feature.json()).error, 'NOT_IMPLEMENTED');
