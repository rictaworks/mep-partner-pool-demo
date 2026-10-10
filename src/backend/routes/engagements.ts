import {validateDateRange} from '../../core';
import type {VerifiedOwner} from '../contracts';
import {Repository} from '../db/repository';
import {empty,fail,onlyKeys,response,validate} from '../http';
export async function engagements(method:string,repo:Repository,owner:VerifiedOwner,body:Record<string,unknown>,partnerId:number,engagementId?:number):Promise<Response> {
 if(method==='GET'){if(!await repo.getPartner(owner,partnerId))fail(404,'NOT_FOUND','対象が見つかりません。');return response(await repo.listEngagements(owner,partnerId));}
 if(method==='POST'){onlyKeys(body,['period','website']);return response(await repo.createEngagement(owner,partnerId,validate(validateDateRange(body.period))),201);}
 if(engagementId===undefined)fail(405,'METHOD_NOT_ALLOWED','操作できません。');onlyKeys(body,['website']);await repo.deleteEngagement(owner,partnerId,engagementId);return empty();
}
