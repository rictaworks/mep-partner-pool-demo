import {FIELDS,match} from '../core';
import type {Assignment,Candidate,Engagement,Field,Partner,Project} from '../core';
import type {AssignmentRequest,VerifiedOwner} from './contracts';
import {Repository} from './db/repository';
import {fail} from './http';
type Roles=Partial<Record<Field,number>>;
interface Snapshot {version:number;project:Project;partners:Partner[];engagements:Engagement[];assignments:Assignment[]}
interface RequestLog {operation:'confirm'|'cancel';fingerprint:string}
/** Owner revision protects snapshot reads through every matching decision and write. */
export class AssignmentService {
 constructor(readonly repo:Repository){}
 private stale():never{fail(409,'STALE_CANDIDATE','条件や稼働が変わりました。候補を再抽出してください。');}
 private async snapshot(owner:VerifiedOwner,projectId:number):Promise<Snapshot>{
  const version=await this.repo.revision(owner),project=await this.repo.getProject(owner,projectId);if(!project)fail(404,'NOT_FOUND','対象が見つかりません。');
  const [partners,engagements,assignments]=await Promise.all([this.repo.listPartners(owner),this.repo.listEngagements(owner),this.repo.getAssignments(owner,projectId)]);
  return {version,project,partners,engagements,assignments};
 }
 private roles(assignments:readonly Assignment[]):Roles {
  const roles:Roles={};for(const assignment of assignments.filter(a=>a.status==='confirmed'))for(const field of assignment.fields)roles[field]=assignment.partnerId;return roles;
 }
 private loads(snapshot:Snapshot):Engagement[]{const ids=new Set(snapshot.assignments.map(a=>a.id));return snapshot.engagements.filter(e=>e.assignmentId===null||!ids.has(e.assignmentId));}
 private fits(candidate:Candidate,roles:Roles,partners:readonly Partner[]):boolean {
  const code=(id:number|undefined)=>partners.find(p=>p.id===id)?.code;
  return (roles['電気']===undefined||candidate.electrical===code(roles['電気']))&&(roles['機械']===undefined||candidate.mechanical===code(roles['機械']));
 }
 private valid(snapshot:Snapshot,roles:Roles):boolean {
  if(snapshot.project.requiredFields.some(f=>roles[f]===undefined))return false;
  const ids=new Set(Object.values(roles)),selected=snapshot.partners.filter(p=>ids.has(p.id));
  return match(snapshot.project,selected,this.loads(snapshot)).candidates.some(candidate=>this.fits(candidate,roles,snapshot.partners));
 }
 private completable(snapshot:Snapshot,roles:Roles):boolean {
  const remaining=snapshot.project.requiredFields.filter(f=>roles[f]===undefined);if(remaining.length===0)return this.valid(snapshot,roles);
  if(remaining.length!==1)return false;
  return snapshot.partners.some(partner=>this.valid(snapshot,{...roles,[remaining[0]!]:partner.id}));
 }
 private async log(owner:VerifiedOwner,projectId:number,key:string):Promise<RequestLog|null>{return this.repo.db.prepare('SELECT operation,fingerprint FROM ASSIGNMENT_REQUEST WHERE session_id=? AND project_id=? AND request_id=?').bind(owner,projectId,key).first<RequestLog>();}
 private async replay(owner:VerifiedOwner,projectId:number,key:string,operation:RequestLog['operation'],fingerprint:string):Promise<boolean>{const log=await this.log(owner,projectId,key);if(!log)return false;if(log.operation!==operation||log.fingerprint!==fingerprint)fail(409,'CONFLICT','同じ要求番号を別の操作には使えません。');return true;}
 private async result(owner:VerifiedOwner,projectId:number){const project=await this.repo.getProject(owner,projectId);if(!project)fail(404,'NOT_FOUND','対象が見つかりません。');return {project,assignments:await this.repo.getAssignments(owner,projectId)};}
 private requestStatement(owner:VerifiedOwner,projectId:number,key:string,operation:RequestLog['operation'],fingerprint:string){return this.repo.db.prepare('INSERT INTO ASSIGNMENT_REQUEST(session_id,project_id,request_id,operation,fingerprint) VALUES(?,?,?,?,?)').bind(owner,projectId,key,operation,fingerprint);}
 private async commit(owner:VerifiedOwner,snapshot:Snapshot,key:string,operation:RequestLog['operation'],fingerprint:string,statements:D1PreparedStatement[]):Promise<void>{
  const count=await this.repo.db.prepare('SELECT COUNT(*) AS n FROM ASSIGNMENT_REQUEST WHERE session_id=?').bind(owner).first<{n:number}>();if(operation==='confirm'&&(count?.n??0)>=2000)fail(409,'CONFLICT','要求履歴の上限です。日次リセット後に再試行してください。');
  try{await this.repo.guardedBatch(owner,snapshot.version,[...statements,this.requestStatement(owner,snapshot.project.id,key,operation,fingerprint)]);}catch(error){
   // A concurrent identical request may have committed before our revision guard failed.
   if(await this.replay(owner,snapshot.project.id,key,operation,fingerprint))return;
   if(error instanceof Error&&/constraint failed|UNIQUE constraint|CHECK constraint|FOREIGN KEY constraint/iu.test(error.message))this.stale();throw error;
  }
 }
 async candidates(owner:VerifiedOwner,projectId:number){
  const snapshot=await this.snapshot(owner,projectId),roles=this.roles(snapshot.assignments);
  // Restrict existing assigned fields BEFORE composing/ranking, so top-20 clipping cannot hide a valid continuation.
  const restricted=snapshot.partners.map(p=>({...p,fields:p.fields.filter(f=>roles[f]===undefined||roles[f]===p.id)}));
  const result=match(snapshot.project,restricted,this.loads(snapshot));
  const state=snapshot.assignments.some(a=>a.status==='confirmed')?snapshot.project.state:'candidates';
  try{await this.repo.guardedBatch(owner,snapshot.version,[this.repo.db.prepare('UPDATE PROJECT SET state=?,revision=revision+1 WHERE session_id=? AND id=?').bind(state,owner,projectId)]);}catch(error){if(error instanceof Error&&/constraint failed|constraint/iu.test(error.message))this.stale();throw error;}
  return {...result,projectRevision:snapshot.project.revision+1};
 }
 async confirm(owner:VerifiedOwner,projectId:number,request:AssignmentRequest){
  const snapshot=await this.snapshot(owner,projectId);
  const selections=request.selections.map(s=>({partnerId:s.partnerId,fields:FIELDS.filter(f=>s.fields.includes(f))})).sort((a,b)=>a.partnerId-b.partnerId);
  const fingerprint=JSON.stringify({projectRevision:request.projectRevision,selections});
  if(await this.replay(owner,projectId,request.requestId,'confirm',fingerprint))return this.result(owner,projectId);
  if(snapshot.project.revision!==request.projectRevision||snapshot.project.state==='registered')this.stale();
  const roles=this.roles(snapshot.assignments);
  for(const selection of selections){
   if(!snapshot.partners.some(p=>p.id===selection.partnerId))fail(404,'NOT_FOUND','対象が見つかりません。');
   for(const field of selection.fields){if(!snapshot.project.requiredFields.includes(field)||(roles[field]!==undefined&&roles[field]!==selection.partnerId))this.stale();roles[field]=selection.partnerId;}
  }
  if(!this.completable(snapshot,roles))this.stale();
  const statements:D1PreparedStatement[]=[],grouped=new Map<number,Field[]>();
  for(const field of snapshot.project.requiredFields){const partnerId=roles[field];if(partnerId!==undefined)grouped.set(partnerId,[...(grouped.get(partnerId)??[]),field]);}
  const active=snapshot.assignments.filter(a=>a.status==='confirmed');
  const added=Array.from(grouped.keys()).filter(id=>!active.some(a=>a.partnerId===id));
  if(snapshot.engagements.length+added.length>1000)fail(409,'CONFLICT','稼働の登録上限に達しました。不要な稼働を取り消してください。');
  for(const [partnerId,fields] of grouped){
   const existing=active.find(a=>a.partnerId===partnerId);
   if(existing) {
    statements.push(this.repo.db.prepare('UPDATE ASSIGNMENT SET fields=? WHERE session_id=? AND id=? AND project_id=?').bind(JSON.stringify(fields),owner,existing.id,projectId));
    for(const field of fields.filter(f=>!existing.fields.includes(f)))statements.push(this.repo.db.prepare('INSERT INTO ASSIGNMENT_FIELD(assignment_id,session_id,project_id,field) VALUES(?,?,?,?)').bind(existing.id,owner,projectId,field));
   } else {
    statements.push(this.repo.db.prepare("INSERT INTO ASSIGNMENT(session_id,project_id,partner_id,request_id,fields,status) VALUES(?,?,?,?,?,'confirmed')").bind(owner,projectId,partnerId,request.requestId,JSON.stringify(fields)));
    for(const field of fields)statements.push(this.repo.db.prepare("INSERT INTO ASSIGNMENT_FIELD(assignment_id,session_id,project_id,field) SELECT id,?,?,? FROM ASSIGNMENT WHERE session_id=? AND project_id=? AND partner_id=? AND status='confirmed'").bind(owner,projectId,field,owner,projectId,partnerId));
    statements.push(this.repo.db.prepare("INSERT INTO ENGAGEMENT(partner_id,session_id,start_date,end_date,assignment_id) SELECT ?,?,?,?,id FROM ASSIGNMENT WHERE session_id=? AND project_id=? AND partner_id=? AND status='confirmed'").bind(partnerId,owner,snapshot.project.period.start,snapshot.project.period.end,owner,projectId,partnerId));
   }
  }
  const state=snapshot.project.requiredFields.every(f=>roles[f]!==undefined)?'assigned':'partial';
  statements.push(this.repo.db.prepare('UPDATE PROJECT SET state=?,revision=revision+1 WHERE session_id=? AND id=?').bind(state,owner,projectId));
  await this.commit(owner,snapshot,request.requestId,'confirm',fingerprint,statements);return this.result(owner,projectId);
 }
 async cancel(owner:VerifiedOwner,projectId:number,assignmentId:number,key:string){
  const snapshot=await this.snapshot(owner,projectId),fingerprint=JSON.stringify({assignmentId});
  if(await this.replay(owner,projectId,key,'cancel',fingerprint))return this.result(owner,projectId);
  const target=snapshot.assignments.find(a=>a.id===assignmentId);if(!target)fail(404,'NOT_FOUND','対象が見つかりません。');if(target.status==='cancelled')return this.result(owner,projectId);
  const remaining=snapshot.assignments.filter(a=>a.id!==assignmentId&&a.status==='confirmed');
  const roles=this.roles(remaining),state=snapshot.project.requiredFields.every(f=>roles[f]!==undefined)?'assigned':remaining.length?'partial':'candidates';
  const statements=[this.repo.db.prepare('DELETE FROM ENGAGEMENT WHERE session_id=? AND assignment_id=? AND partner_id=?').bind(owner,assignmentId,target.partnerId),this.repo.db.prepare('DELETE FROM ASSIGNMENT_FIELD WHERE session_id=? AND project_id=? AND assignment_id=?').bind(owner,projectId,assignmentId),this.repo.db.prepare("UPDATE ASSIGNMENT SET status='cancelled' WHERE session_id=? AND project_id=? AND id=?").bind(owner,projectId,assignmentId),this.repo.db.prepare('UPDATE PROJECT SET state=?,revision=revision+1 WHERE session_id=? AND id=?').bind(state,owner,projectId)];
  await this.commit(owner,snapshot,key,'cancel',fingerprint,statements);return this.result(owner,projectId);
 }
}
