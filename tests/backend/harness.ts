import { readFileSync, readdirSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
export async function databaseHarness() {
 const options = convertV4MiniflareOptions({cf:false,workers:[{name:'test',modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-09',d1Databases:{DB:'test-db'}}]});
 options.telemetry={enabled:false};
 const mf = new Miniflare(options);
 try {
 const raw = await mf.getD1Database('DB') as unknown as D1Database;
 const db:D1Database = {
  prepare:query=>raw.prepare(query),exec:query=>raw.exec(query),
  withSession:bookmark=>raw.withSession(bookmark),dump:()=>raw.dump(),
  async batch<T>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]> {
   // Miniflare prepare/bind uses a synchronous bridge. Large statement builds can
   // block Node past workerd's idle timeout; process queued connection cleanup
   // before the async result fetch. Execute the real D1 batch exactly once.
   await new Promise<void>(resolve=>setTimeout(resolve,0));
   return raw.batch<T>(statements);
  },
 };
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
