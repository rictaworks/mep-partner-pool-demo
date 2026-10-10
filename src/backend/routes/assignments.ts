import {FIELDS} from '../../core';
import type {Field} from '../../core';
import type {AssignmentRequest,VerifiedOwner} from '../contracts';
import {Repository} from '../db/repository';
import {fail,object,onlyKeys,response} from '../http';
import {AssignmentService} from '../assignment-service';
function key(value:unknown):string{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,64}$/u.test(value))fail(400,'VALIDATION','要求番号が不正です。');return value;}
export async function assignments(repo:Repository,owner:VerifiedOwner,projectId:number,body:Record<string,unknown>,assignmentId?:number):Promise<Response>{
 const service=new AssignmentService(repo),requestId=key(body.requestId);
 if(assignmentId!==undefined){onlyKeys(body,['website','requestId']);return response(await service.cancel(owner,projectId,assignmentId,requestId));}
 onlyKeys(body,['website','requestId','projectRevision','selections']);
 if(typeof body.projectRevision!=='number'||!Number.isSafeInteger(body.projectRevision)||body.projectRevision<0)fail(400,'VALIDATION','案件の更新番号が不正です。');
 if(!Array.isArray(body.selections)||body.selections.length<1||body.selections.length>2)fail(400,'VALIDATION','担当事務所を指定してください。');
 const selections=body.selections.map(value=>{
  if(!object(value))fail(400,'VALIDATION','担当指定が不正です。');onlyKeys(value,['partnerId','fields']);
  if(typeof value.partnerId!=='number'||!Number.isSafeInteger(value.partnerId)||value.partnerId<1)fail(400,'VALIDATION','事務所IDが不正です。');
  if(!Array.isArray(value.fields)||value.fields.length<1||value.fields.length>2||value.fields.some(f=>typeof f!=='string'||!FIELDS.includes(f as Field))||new Set(value.fields).size!==value.fields.length)fail(400,'VALIDATION','担当分野が不正です。');
  return {partnerId:value.partnerId,fields:value.fields as Field[]};
 });
 if(new Set(selections.map(s=>s.partnerId)).size!==selections.length||new Set(selections.flatMap(s=>s.fields)).size!==selections.flatMap(s=>s.fields).length)fail(400,'VALIDATION','事務所や担当分野を重複指定できません。');
 const request:AssignmentRequest={website:'',requestId,projectRevision:body.projectRevision,selections};return response(await service.confirm(owner,projectId,request));
}
