import { FIELDS, LICENSES, USES, WORK_TYPES, SERVICES } from '../core';
import type { PartnerInput, ProjectInput } from '../core';
import type { VerifiedOwner } from './contracts';
/** Fictional, non-identifying demo examples. No real businesses or contact details. */
export const SAMPLE_PARTNERS: readonly PartnerInput[] = Array.from({length:10},(_,i)=>({
 code:`DEMO${String(i+1).padStart(2,'0')}`,shortName:`架空事務所${String.fromCharCode(65+i)}`,
 fields:i%3===0 ? [...FIELDS] : [FIELDS[i%2]!],licenses:[LICENSES[i%LICENSES.length]!],
 experience:{'教育施設':{'新築':i,'改修':10-i},'公営住宅':{'新築':i%4,'改修':i%3},'公共施設':{'新築':i+1,'改修':i%5}},
 regions:i%2===0 ? ['13-all'] : ['14-all'],services:[...SERVICES],capacity:2+i%3,active:true,
}));
export const SAMPLE_PROJECTS: readonly ProjectInput[] = [
 {name:'架空教育施設計画',requiredFields:[...FIELDS],workType:'新築',use:'教育施設',region:'13101',floors:3,floorArea:5200,period:{start:'2026-11-01',end:'2027-03-31'},requiredServices:['積算'],orderType:'入札',requireListedLicense:true},
 {name:'架空住宅改修計画',requiredFields:['機械'],workType:'改修',use:'公営住宅',region:'14100',floors:2,floorArea:3000,period:{start:'2026-12-01',end:'2027-02-28'},requiredServices:['役所打合せ'],orderType:'プロポーザル',requireListedLicense:false},
 {name:'架空公共施設計画',requiredFields:['電気'],workType:'新築',use:'公共施設',region:'13201',floors:2,floorArea:1500,period:{start:'2027-01-01',end:'2027-05-31'},requiredServices:[],orderType:'入札',requireListedLicense:false},
];
export function partnerInsert(db:D1Database,owner:VerifiedOwner,input:PartnerInput):D1PreparedStatement[] {
 const statements=[db.prepare('INSERT INTO PARTNER(session_id,code,short_name,capacity,active) VALUES(?,?,?,?,?)').bind(owner,input.code,input.shortName,input.capacity,input.active?1:0)];
 const member=(table:string,column:string,values:readonly string[])=>values.map(v=>db.prepare(`INSERT INTO ${table}(partner_id,session_id,${column}) SELECT id,?,? FROM PARTNER WHERE session_id=? AND code=?`).bind(owner,v,owner,input.code));
 statements.push(...member('PARTNER_FIELD','field',input.fields),...member('PARTNER_LICENSE','license',input.licenses),...member('PARTNER_REGION','region_code',input.regions),...member('PARTNER_SERVICE','service',input.services));
 for(const use of USES)for(const work of WORK_TYPES)statements.push(db.prepare('INSERT INTO PARTNER_EXPERIENCE(partner_id,session_id,use,work_type,count) SELECT id,?,?,?,? FROM PARTNER WHERE session_id=? AND code=?').bind(owner,use,work,input.experience[use][work],owner,input.code));
 return statements;
}
export function projectInsert(db:D1Database,owner:VerifiedOwner,input:ProjectInput):D1PreparedStatement[] {
 const statements=[db.prepare('INSERT INTO PROJECT(session_id,name,fields,work_type,use,region_code,floors,floor_area,start_date,due_date,order_type,require_listed_license) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(owner,input.name,JSON.stringify(input.requiredFields),input.workType,input.use,input.region,input.floors,input.floorArea,input.period.start,input.period.end,input.orderType,input.requireListedLicense?1:0)];
 // Atomic batch guarantees the latest owner project is the one just inserted, including multiple services.
 for(const service of input.requiredServices)statements.push(db.prepare('INSERT INTO PROJECT_SERVICE(project_id,session_id,service) SELECT MAX(id),?,? FROM PROJECT WHERE session_id=?').bind(owner,service,owner));
 return statements;
}
export function seedStatements(db:D1Database,owner:VerifiedOwner):D1PreparedStatement[] {return [...SAMPLE_PARTNERS.flatMap(p=>partnerInsert(db,owner,p)),...SAMPLE_PROJECTS.flatMap(p=>projectInsert(db,owner,p))];}
