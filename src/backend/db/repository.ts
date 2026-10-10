import type { Assignment, Engagement, Field, License, Partner, Project, Service, Use, WorkType, Experience, ProjectState, OrderType, PartnerInput, ProjectInput, DateRange } from '../../core';
import type { VerifiedOwner } from '../contracts';
import {partnerInsert,projectInsert} from '../seed';
import {ApiFailure} from '../http';
import {USES,WORK_TYPES} from '../../core';
interface PartnerRow {id:number;code:string;short_name:string;capacity:number;active:number;revision:number}
interface ProjectRow {id:number;name:string;fields:string;work_type:WorkType;use:Use;region_code:string;floors:number;floor_area:number;start_date:string;due_date:string;order_type:OrderType;require_listed_license:number;state:ProjectState;revision:number}
interface EngagementRow {id:number;partner_id:number;partner_code:string;start_date:string;end_date:string;assignment_id:number|null}
/** No owner default, no in-memory fallback, no query from request-controlled SQL. */
export class Repository {
 constructor(readonly db:D1Database) {}
 async revision(owner:VerifiedOwner):Promise<number> {
  const row=await this.db.prepare('SELECT revision FROM SESSION WHERE session_id=?').bind(owner).first<{revision:number}>();
  if(!row)throw new Error('SESSION_MISSING');return row.revision;
 }
 /** Optimistic snapshot revision protects the whole read/check/write cycle in an atomic D1 batch. */
 async guardedBatch(owner:VerifiedOwner,expectedRevision:number,statements:readonly D1PreparedStatement[]):Promise<D1Result[]> {
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new Error('INVALID_REVISION');
  return this.db.batch([
   this.db.prepare('UPDATE SESSION SET revision=revision+1 WHERE session_id=? AND revision=?').bind(owner,expectedRevision),
   this.db.prepare('INSERT INTO WRITE_GUARD(session_id,assertion) VALUES(?,changes())').bind(owner),
   ...statements,
   this.db.prepare('DELETE FROM WRITE_GUARD WHERE session_id=?').bind(owner),
  ]);
 }
 async listPartners(owner:VerifiedOwner):Promise<Partner[]> {
  const rows=await this.db.prepare('SELECT id,code,short_name,capacity,active,revision FROM PARTNER WHERE session_id=? ORDER BY code').bind(owner).all<PartnerRow>();
  return Promise.all(rows.results.map(row=>this.partner(owner,row)));
 }
 async getPartner(owner:VerifiedOwner,id:number):Promise<Partner|null> {
  const row=await this.db.prepare('SELECT id,code,short_name,capacity,active,revision FROM PARTNER WHERE session_id=? AND id=?').bind(owner,id).first<PartnerRow>();
  return row ? this.partner(owner,row) : null;
 }
 private async partner(owner:VerifiedOwner,row:PartnerRow):Promise<Partner> {
  const [fields,licenses,regions,services,counts]=await Promise.all([
   this.db.prepare('SELECT field FROM PARTNER_FIELD WHERE session_id=? AND partner_id=? ORDER BY field').bind(owner,row.id).all<{field:Field}>(),
   this.db.prepare('SELECT license FROM PARTNER_LICENSE WHERE session_id=? AND partner_id=? ORDER BY license').bind(owner,row.id).all<{license:License}>(),
   this.db.prepare('SELECT region_code FROM PARTNER_REGION WHERE session_id=? AND partner_id=? ORDER BY region_code').bind(owner,row.id).all<{region_code:string}>(),
   this.db.prepare('SELECT service FROM PARTNER_SERVICE WHERE session_id=? AND partner_id=? ORDER BY service').bind(owner,row.id).all<{service:Service}>(),
   this.db.prepare('SELECT use,work_type,count FROM PARTNER_EXPERIENCE WHERE session_id=? AND partner_id=?').bind(owner,row.id).all<{use:Use;work_type:WorkType;count:number}>(),
  ]);
  const experience:Record<Use,Record<WorkType,number>>={'教育施設':{'新築':0,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':0,'改修':0}};
  for(const count of counts.results)experience[count.use][count.work_type]=count.count;
  return {id:row.id,code:row.code,shortName:row.short_name,capacity:row.capacity,active:row.active===1,revision:row.revision,fields:fields.results.map(r=>r.field),licenses:licenses.results.map(r=>r.license),regions:regions.results.map(r=>r.region_code),services:services.results.map(r=>r.service),experience:experience as Experience};
 }
 async listProjects(owner:VerifiedOwner):Promise<Project[]> {
  const rows=await this.db.prepare('SELECT * FROM PROJECT WHERE session_id=? ORDER BY id').bind(owner).all<ProjectRow>();
  return Promise.all(rows.results.map(row=>this.project(owner,row)));
 }
 async getProject(owner:VerifiedOwner,id:number):Promise<Project|null> {
  const row=await this.db.prepare('SELECT * FROM PROJECT WHERE session_id=? AND id=?').bind(owner,id).first<ProjectRow>();return row?this.project(owner,row):null;
 }
 private async project(owner:VerifiedOwner,row:ProjectRow):Promise<Project> {
  const services=await this.db.prepare('SELECT service FROM PROJECT_SERVICE WHERE session_id=? AND project_id=? ORDER BY service').bind(owner,row.id).all<{service:Service}>();
  return {id:row.id,name:row.name,requiredFields:JSON.parse(row.fields) as Field[],workType:row.work_type,use:row.use,region:row.region_code,floors:row.floors,floorArea:row.floor_area,period:{start:row.start_date,end:row.due_date},orderType:row.order_type,requireListedLicense:row.require_listed_license===1,state:row.state,revision:row.revision,requiredServices:services.results.map(r=>r.service)};
 }
 async listEngagements(owner:VerifiedOwner,partnerId?:number):Promise<Engagement[]> {
  const rows=await this.db.prepare('SELECT e.id,e.partner_id,p.code AS partner_code,e.start_date,e.end_date,e.assignment_id FROM ENGAGEMENT e JOIN PARTNER p ON p.id=e.partner_id AND p.session_id=e.session_id WHERE e.session_id=? AND (? IS NULL OR e.partner_id=?) ORDER BY e.id').bind(owner,partnerId??null,partnerId??null).all<EngagementRow>();
  return rows.results.map(row=>({id:row.id,partnerId:row.partner_id,partnerCode:row.partner_code,assignmentId:row.assignment_id,period:{start:row.start_date,end:row.end_date}}));
 }
 async getAssignments(owner:VerifiedOwner,projectId:number):Promise<Assignment[]> {
  const rows=await this.db.prepare('SELECT id,project_id,partner_id,fields,request_id,status FROM ASSIGNMENT WHERE session_id=? AND project_id=? ORDER BY id').bind(owner,projectId).all<{id:number;project_id:number;partner_id:number;fields:string;request_id:string;status:'confirmed'|'cancelled'}>();
  return rows.results.map(row=>({id:row.id,projectId:row.project_id,partnerId:row.partner_id,fields:JSON.parse(row.fields) as Field[],requestId:row.request_id,status:row.status}));
 }

 private missing():never{throw new ApiFailure(404,'NOT_FOUND','対象が見つかりません。');}
 private conflict():never{throw new ApiFailure(409,'CONFLICT','データが変更されたか割当中です。再取得し、必要な割当を取り消してください。');}
 private async write(owner:VerifiedOwner,version:number,statements:readonly D1PreparedStatement[]):Promise<D1Result[]> {
  try{return await this.guardedBatch(owner,version,statements);}catch(error){if(error instanceof Error && /constraint failed|UNIQUE constraint|CHECK constraint|FOREIGN KEY constraint/iu.test(error.message))this.conflict();throw error;}
 }
 private async limit(owner:VerifiedOwner,table:'PARTNER'|'PROJECT'|'ENGAGEMENT',max:number):Promise<void> {
  const row=await this.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE session_id=?`).bind(owner).first<{n:number}>();if((row?.n??0)>=max)throw new ApiFailure(409,'CONFLICT','このセッションの登録上限に達しました。不要なデータを削除してください。');
 }
 async createPartner(owner:VerifiedOwner,input:PartnerInput):Promise<Partner> {
  const version=await this.revision(owner);await this.limit(owner,'PARTNER',100);
  const results=await this.write(owner,version,partnerInsert(this.db,owner,input));
  const value=await this.getPartner(owner,Number(results[2]?.meta.last_row_id));if(!value)this.conflict();return value;
 }
 async updatePartner(owner:VerifiedOwner,id:number,input:PartnerInput,expected:number):Promise<Partner> {
  const version=await this.revision(owner),current=await this.getPartner(owner,id);if(!current)this.missing();if(current.revision!==expected)this.conflict();
  const assigned=await this.db.prepare("SELECT 1 FROM ASSIGNMENT WHERE session_id=? AND partner_id=? AND status='confirmed'").bind(owner,id).first();if(assigned)this.conflict();
  const statements=[this.db.prepare('UPDATE PARTNER SET code=?,short_name=?,capacity=?,active=?,revision=revision+1 WHERE session_id=? AND id=? AND revision=?').bind(input.code,input.shortName,input.capacity,input.active?1:0,owner,id,expected)];
  for(const table of ['PARTNER_FIELD','PARTNER_LICENSE','PARTNER_REGION','PARTNER_SERVICE','PARTNER_EXPERIENCE'])statements.push(this.db.prepare(`DELETE FROM ${table} WHERE session_id=? AND partner_id=?`).bind(owner,id));
  const member=(table:string,column:string,values:readonly string[])=>values.map(v=>this.db.prepare(`INSERT INTO ${table}(partner_id,session_id,${column}) VALUES(?,?,?)`).bind(id,owner,v));
  statements.push(...member('PARTNER_FIELD','field',input.fields),...member('PARTNER_LICENSE','license',input.licenses),...member('PARTNER_REGION','region_code',input.regions),...member('PARTNER_SERVICE','service',input.services));
  for(const use of USES)for(const work of WORK_TYPES)statements.push(this.db.prepare('INSERT INTO PARTNER_EXPERIENCE(partner_id,session_id,use,work_type,count) VALUES(?,?,?,?,?)').bind(id,owner,use,work,input.experience[use][work]));
  await this.write(owner,version,statements);const value=await this.getPartner(owner,id);if(!value)this.conflict();return value;
 }
 async deletePartner(owner:VerifiedOwner,id:number):Promise<void> {
  const version=await this.revision(owner);if(!await this.getPartner(owner,id))this.missing();
  if(await this.db.prepare("SELECT 1 FROM ASSIGNMENT WHERE session_id=? AND partner_id=? AND status='confirmed'").bind(owner,id).first())this.conflict();
  await this.write(owner,version,[this.db.prepare("DELETE FROM ASSIGNMENT WHERE session_id=? AND partner_id=? AND status='cancelled'").bind(owner,id),this.db.prepare('DELETE FROM PARTNER WHERE session_id=? AND id=?').bind(owner,id)]);
 }
 async createProject(owner:VerifiedOwner,input:ProjectInput):Promise<Project> {
  const version=await this.revision(owner);await this.limit(owner,'PROJECT',100);
  const results=await this.write(owner,version,projectInsert(this.db,owner,input));const value=await this.getProject(owner,Number(results[2]?.meta.last_row_id));if(!value)this.conflict();return value;
 }
 async updateProject(owner:VerifiedOwner,id:number,input:ProjectInput,expected:number):Promise<Project> {
  const version=await this.revision(owner),current=await this.getProject(owner,id);if(!current)this.missing();if(current.revision!==expected)this.conflict();
  if((await this.getAssignments(owner,id)).some(a=>a.status==='confirmed'))this.conflict();
  const statements=[this.db.prepare("UPDATE PROJECT SET name=?,fields=?,work_type=?,use=?,region_code=?,floors=?,floor_area=?,start_date=?,due_date=?,order_type=?,require_listed_license=?,state='registered',revision=revision+1 WHERE session_id=? AND id=? AND revision=?").bind(input.name,JSON.stringify(input.requiredFields),input.workType,input.use,input.region,input.floors,input.floorArea,input.period.start,input.period.end,input.orderType,input.requireListedLicense?1:0,owner,id,expected),this.db.prepare('DELETE FROM PROJECT_SERVICE WHERE session_id=? AND project_id=?').bind(owner,id)];
  statements.push(...input.requiredServices.map(service=>this.db.prepare('INSERT INTO PROJECT_SERVICE(project_id,session_id,service) VALUES(?,?,?)').bind(id,owner,service)));
  await this.write(owner,version,statements);const value=await this.getProject(owner,id);if(!value)this.conflict();return value;
 }
 async deleteProject(owner:VerifiedOwner,id:number):Promise<void> {
  const version=await this.revision(owner);if(!await this.getProject(owner,id))this.missing();if((await this.getAssignments(owner,id)).some(a=>a.status==='confirmed'))this.conflict();
  await this.write(owner,version,[this.db.prepare('DELETE FROM PROJECT WHERE session_id=? AND id=?').bind(owner,id)]);
 }
 async createEngagement(owner:VerifiedOwner,partnerId:number,period:DateRange):Promise<Engagement> {
  const version=await this.revision(owner);if(!await this.getPartner(owner,partnerId))this.missing();await this.limit(owner,'ENGAGEMENT',1000);
  const results=await this.write(owner,version,[this.db.prepare('INSERT INTO ENGAGEMENT(partner_id,session_id,start_date,end_date,assignment_id) VALUES(?,?,?,?,NULL)').bind(partnerId,owner,period.start,period.end)]);
  const value=(await this.listEngagements(owner,partnerId)).find(e=>e.id===Number(results[2]?.meta.last_row_id));if(!value)this.conflict();return value;
 }
 async deleteEngagement(owner:VerifiedOwner,partnerId:number,id:number):Promise<void> {
  const version=await this.revision(owner);if(!await this.getPartner(owner,partnerId))this.missing();
  const value=(await this.listEngagements(owner,partnerId)).find(e=>e.id===id);if(!value)this.missing();if(value.assignmentId!==null)this.conflict();
  await this.write(owner,version,[this.db.prepare('DELETE FROM ENGAGEMENT WHERE session_id=? AND partner_id=? AND id=? AND assignment_id IS NULL').bind(owner,partnerId,id)]);
 }
}
