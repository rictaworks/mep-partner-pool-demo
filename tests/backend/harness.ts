import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
export async function databaseHarness() {
 const options = convertV4MiniflareOptions({cf:false,workers:[{name:'test',modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-09',d1Databases:{DB:'test-db'}}]});
 options.telemetry={enabled:false};
 const mf = new Miniflare(options);
 try {
 const db = await mf.getD1Database('DB');
 for (const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort()) {
  const sql = readFileSync(`migrations/${file}`,'utf8');
  // Each statement is sent through real workerd D1; triggers remain whole SQL statements.
  const statements = sql.split('-- statement-break').map(s=>s.trim()).filter(Boolean);
  for (const statement of statements) await db.prepare(statement).run();
 }
 return {db:db as unknown as D1Database,dispose:()=>mf.dispose()};
 } catch(error) {
  // Initialization failures occur before callers can enter their own finally blocks.
  await mf.dispose();
  throw error;
 }
}
