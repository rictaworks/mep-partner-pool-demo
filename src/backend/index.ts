import {scheduledReset} from './reset';
import {REGIONS} from '../core';
import {Repository} from './db/repository';
import {checkMutationRequest,getSession} from './session';
import {empty,errorResponse,fail,id,readBody,response} from './http';
import {partners} from './routes/partners';
import {projects} from './routes/projects';
import {engagements} from './routes/engagements';
import {candidates} from './routes/candidates';
import {assignments} from './routes/assignments';
export interface Env {DB:D1Database;APP_ORIGIN?:string}
/** Same-origin HTTP adapter. Authentication-free demo ownership is a verified Cookie session. */
export async function handleApi(request:Request,env:Env):Promise<Response> {
 try {
  const url=new URL(request.url),path=url.pathname;
  if(url.search)fail(400,'VALIDATION','このAPIはクエリ指定を受け付けません。');
  if(path==='/api/health'){if(request.method!=='GET')fail(405,'METHOD_NOT_ALLOWED','操作できません。');return Response.json({status:'demo-ready',featuresImplemented:true},{headers:{'Cache-Control':'no-store'}});}
  if(path==='/api/regions'){if(request.method!=='GET')fail(405,'METHOD_NOT_ALLOWED','操作できません。');return response(REGIONS);}
  const pm=/^\/api\/partners(?:\/([^/]+))?$/u.exec(path),pj=/^\/api\/projects(?:\/([^/]+))?$/u.exec(path),em=/^\/api\/partners\/([^/]+)\/engagements(?:\/([^/]+))?$/u.exec(path);
  const cm=/^\/api\/projects\/([^/]+)\/candidates$/u.exec(path),am=/^\/api\/projects\/([^/]+)\/assignments(?:\/([^/]+))?$/u.exec(path);
  if(!pm&&!pj&&!em&&!cm&&!am)fail(404,'NOT_FOUND','対象が見つかりません。');
  const mainId=pm?.[1]??pj?.[1]??em?.[1]??cm?.[1]??am?.[1],entityId=mainId===undefined?undefined:id(mainId),engagementId=em?.[2]===undefined?undefined:id(em[2]);
  const assignmentId=am?.[2]===undefined?undefined:id(am[2]);
  const methods=cm?['POST']:am?(assignmentId===undefined?['POST']:['DELETE']):em?(engagementId===undefined?['GET','POST']:['DELETE']):(entityId===undefined?['GET','POST']:['GET','PUT','DELETE']);
  if(!methods.includes(request.method))fail(405,'METHOD_NOT_ALLOWED','操作できません。');
  const protection=checkMutationRequest(request,env.APP_ORIGIN);if(protection)return protection;
  const body=request.method==='GET'?{}:await readBody(request);if(body.website) return empty();
  const session=await getSession(request,env.DB),repo=new Repository(env.DB);
  let result:Response;
  try {result=cm?await candidates(repo,session.owner,entityId!,body):am?await assignments(repo,session.owner,entityId!,body,assignmentId):em?await engagements(request.method,repo,session.owner,body,entityId!,engagementId):pm?await partners(request.method,repo,session.owner,body,entityId):await projects(request.method,repo,session.owner,body,entityId);}catch(error){result=errorResponse(error);}
  if(session.cookie)result.headers.set('Set-Cookie',session.cookie);
  return result;
 }catch(error){return errorResponse(error);}
}
export default {fetch:handleApi,scheduled:scheduledReset} satisfies ExportedHandler<Env>;
