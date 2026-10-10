import {validateProject} from '../../core';
import type {VerifiedOwner} from '../contracts';
import {Repository} from '../db/repository';
import {domainBody,empty,fail,onlyKeys,response,revision,validate} from '../http';
export async function projects(method:string,repo:Repository,owner:VerifiedOwner,body:Record<string,unknown>,projectId?:number):Promise<Response> {
 if(method==='GET') {if(projectId===undefined)return response(await repo.listProjects(owner));const data=await repo.getProject(owner,projectId);if(!data)fail(404,'NOT_FOUND','対象が見つかりません。');return response({...data,assignments:await repo.getAssignments(owner,projectId)});}
 if(method==='POST') {const data=await repo.createProject(owner,validate(validateProject(domainBody(body))));return response({...data,assignments:[]},201);}
 if(projectId===undefined)fail(405,'METHOD_NOT_ALLOWED','操作できません。');
 if(method==='PUT'){const data=await repo.updateProject(owner,projectId,validate(validateProject(domainBody(body,true))),revision(body));return response({...data,assignments:await repo.getAssignments(owner,projectId)});}
 onlyKeys(body,['website']);await repo.deleteProject(owner,projectId);return empty();
}
