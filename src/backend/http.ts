import { MAX_BODY_BYTES } from './contracts';
import type {ApiErrorCode} from './contracts';
import type {ValidationError,ValidationResult} from '../core';
export class ApiFailure extends Error {
 constructor(readonly status:number,readonly code:ApiErrorCode,message:string,readonly details?:readonly ValidationError[]){super(message);}
}
export function fail(status:number,code:ApiErrorCode,message:string):never{throw new ApiFailure(status,code,message);}
export function response(data:unknown,status=200):Response {return Response.json({data},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function empty():Response{return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});}
export function errorResponse(error:unknown):Response {
 const failure=error instanceof ApiFailure?error:new ApiFailure(500,'INTERNAL','処理できませんでした。時間をおいて再試行してください。');
 return Response.json({error:{code:failure.code,message:failure.message,...(failure.details?{details:failure.details}:{})}},{status:failure.status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export function object(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
/** Stream limit remains effective even without or with a forged Content-Length. */
export async function readBody(request:Request):Promise<Record<string,unknown>> {
 const length=request.headers.get('Content-Length');if(length!==null&&(!/^\d+$/u.test(length)||Number(length)>MAX_BODY_BYTES))fail(413,'BODY_TOO_LARGE','送信サイズが大きすぎます。');
 const reader=request.body?.getReader();if(!reader)fail(400,'BAD_JSON','JSONを送信してください。');
 const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>MAX_BODY_BYTES){await reader.cancel();fail(413,'BODY_TOO_LARGE','送信サイズが大きすぎます。');}chunks.push(chunk.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes));}catch{fail(400,'BAD_JSON','正しいJSONを送信してください。');}
 if(!object(value))fail(400,'VALIDATION','入力オブジェクトが必要です。');
 if(typeof value.website!=='string')fail(400,'VALIDATION','入力形式が不正です。');
 return value;
}
export function id(value:string):number{if(!/^[1-9]\d*$/u.test(value)||!Number.isSafeInteger(Number(value)))fail(400,'VALIDATION','IDが不正です。');return Number(value);}
export function validate<T>(result:ValidationResult<T>):T {if(!result.ok)throw new ApiFailure(400,'VALIDATION','入力内容を確認してください。',result.errors);return result.value;}
export function domainBody(body:Record<string,unknown>,update=false):Record<string,unknown> {const {website,revision,...data}=body;void website;if(!update&&revision!==undefined)fail(400,'VALIDATION','入力形式が不正です。');return data;}
export function revision(body:Record<string,unknown>):number {if(typeof body.revision!=='number'||!Number.isSafeInteger(body.revision)||body.revision<0)fail(400,'VALIDATION','更新番号が不正です。');return body.revision;}
export function onlyKeys(body:Record<string,unknown>,keys:readonly string[]):void {if(Object.keys(body).some(key=>!keys.includes(key)))fail(400,'VALIDATION','入力形式が不正です。');}
