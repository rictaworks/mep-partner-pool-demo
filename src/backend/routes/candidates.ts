import type {VerifiedOwner} from '../contracts';
import {Repository} from '../db/repository';
import {onlyKeys,response} from '../http';
import {AssignmentService} from '../assignment-service';
export async function candidates(repo:Repository,owner:VerifiedOwner,projectId:number,body:Record<string,unknown>):Promise<Response>{onlyKeys(body,['website']);return response(await new AssignmentService(repo).candidates(owner,projectId));}
