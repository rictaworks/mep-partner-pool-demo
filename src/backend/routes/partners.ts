import {validatePartner} from '../../core';
import type {VerifiedOwner} from '../contracts';
import {Repository} from '../db/repository';
import {domainBody,empty,fail,onlyKeys,response,revision,validate} from '../http';
export async function partners(method:string,repo:Repository,owner:VerifiedOwner,body:Record<string,unknown>,partnerId?:number):Promise<Response> {
 if(method==='GET') {const data=partnerId===undefined?await repo.listPartners(owner):await repo.getPartner(owner,partnerId);if(data===null)fail(404,'NOT_FOUND','対象が見つかりません。');return response(data);}
 if(method==='POST')return response(await repo.createPartner(owner,validate(validatePartner(domainBody(body)))),201);
 if(partnerId===undefined)fail(405,'METHOD_NOT_ALLOWED','操作できません。');
 if(method==='PUT')return response(await repo.updatePartner(owner,partnerId,validate(validatePartner(domainBody(body,true))),revision(body)));
 onlyKeys(body,['website']);await repo.deletePartner(owner,partnerId);return empty();
}
