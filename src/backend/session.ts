import { SESSION_COOKIE } from './contracts';
import type { VerifiedOwner } from './contracts';
import { seedStatements } from './seed';
export interface SessionResult { readonly owner: VerifiedOwner; readonly cookie: string | null }
export const SESSION_MAX_AGE = 86_400;
/** An existing, unexpired database row alone establishes request ownership. */
export async function getSession(request:Request,db:D1Database,now = Date.now()):Promise<SessionResult> {
 const matches=(request.headers.get('Cookie')??'').split(';').map(p=>p.trim()).filter(p=>p.startsWith(`${SESSION_COOKIE}=`));
 const token=matches.length===1 ? matches[0]!.slice(SESSION_COOKIE.length+1) : '';
 if(/^[a-f0-9]{64}$/u.test(token)) {
  const row=await db.prepare('SELECT session_id FROM SESSION WHERE session_id=? AND expires_at>?').bind(token,Math.floor(now/1000)).first<{session_id:string}>();
  if(row)return {owner:row.session_id as VerifiedOwner,cookie:null};
 }
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
 const owner=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('') as VerifiedOwner;
 await db.batch([db.prepare('INSERT INTO SESSION(session_id,created_at,expires_at) VALUES(?,?,?)').bind(owner,new Date(now).toISOString(),Math.floor(now/1000)+SESSION_MAX_AGE),...seedStatements(db,owner)]);
 const secure=new URL(request.url).protocol==='https:' ? '; Secure' : '';
 return {owner,cookie:`${SESSION_COOKIE}=${owner}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`};
}
/** Run before session creation and body parsing. GET/HEAD are read-only. */
export function checkMutationRequest(request:Request,applicationOrigin?:string):Response|null {
 if(['GET','HEAD','OPTIONS'].includes(request.method))return null;
 const url=new URL(request.url),origin=request.headers.get('Origin');
 if(origin!==(applicationOrigin??url.origin) || request.headers.get('Sec-Fetch-Site')==='cross-site')return Response.json({error:{code:'CSRF',message:'同一サイトから操作してください。'}},{status:403,headers:{'Cache-Control':'no-store'}});
 const media=(request.headers.get('Content-Type')??'').split(';')[0]?.trim().toLowerCase();
 if(media!=='application/json')return Response.json({error:{code:'UNSUPPORTED_MEDIA_TYPE',message:'JSON形式で送信してください。'}},{status:415,headers:{'Cache-Control':'no-store'}});
 return null;
}
