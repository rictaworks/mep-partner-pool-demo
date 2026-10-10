import { FIELDS, LICENSES, USES, WORK_TYPES, SERVICES, ORDER_TYPES } from './types';
import type { DateRange, PartnerInput, ProjectInput, ValidationError, ValidationResult } from './types';
import { isRegionCode } from './regions';
type ObjectValue = Record<string, unknown>;
function record(value: unknown): value is ObjectValue { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function issue(errors: ValidationError[], path: string, valid: boolean): void { if (!valid) errors.push({path, message:'入力値が不正です。'}); }
function keys(value: ObjectValue, allowed: readonly string[], errors: ValidationError[], path = ''): void { for (const key of Object.keys(value)) issue(errors, path ? `${path}.${key}` : key, allowed.includes(key)); }
function text(value: unknown, max: number): boolean { return typeof value === 'string' && value.trim().length > 0 && value.length <= max && Array.from(value).every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127); }
function integer(value: unknown, min: number): boolean { return typeof value === 'number' && Number.isSafeInteger(value) && value >= min; }
function enumeration(value: unknown, values: readonly string[]): boolean { return typeof value === 'string' && values.includes(value); }
function set(value: unknown, values: readonly string[], nonempty = false): boolean { return Array.isArray(value) && (!nonempty || value.length > 0) && value.length <= values.length && value.every(v => enumeration(v, values)) && new Set(value).size === value.length; }
function date(value: unknown): value is string {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
 const y = Number(value.slice(0,4)), m = Number(value.slice(5,7)), d = Number(value.slice(8,10));
 const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
 const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
 return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= (days[m-1] ?? 0);
}
export function validateDateRange(value: unknown): ValidationResult<DateRange> {
 const errors: ValidationError[] = [];
 if (!record(value)) return {ok:false,errors:[{path:'period',message:'期間が必要です。'}]};
 keys(value,['start','end'],errors,'period');
 issue(errors,'period.start',date(value.start)); issue(errors,'period.end',date(value.end));
 if (date(value.start) && date(value.end)) issue(errors,'period',value.start <= value.end);
 return errors.length ? {ok:false,errors} : {ok:true,value:value as unknown as DateRange};
}
export function validatePartner(value: unknown): ValidationResult<PartnerInput> {
 const errors: ValidationError[] = [];
 if (!record(value)) return {ok:false,errors:[{path:'partner',message:'事務所情報が必要です。'}]};
 keys(value,['code','shortName','fields','licenses','experience','regions','services','capacity','active'],errors);
 issue(errors,'code',typeof value.code === 'string' && /^[A-Za-z0-9_-]{1,32}$/u.test(value.code));
 issue(errors,'shortName',text(value.shortName,80));
 issue(errors,'fields',set(value.fields,FIELDS,true)); issue(errors,'licenses',set(value.licenses,LICENSES));
 issue(errors,'services',set(value.services,SERVICES));
 issue(errors,'regions',Array.isArray(value.regions) && value.regions.length <= 70 && value.regions.every(r => isRegionCode(r,true)) && new Set(value.regions).size === value.regions.length);
 issue(errors,'capacity',integer(value.capacity,0)); issue(errors,'active',typeof value.active === 'boolean');
 if (!record(value.experience)) issue(errors,'experience',false);
 else {
  keys(value.experience,USES,errors,'experience');
  for (const use of USES) {
   const counts = value.experience[use];
   if (!record(counts)) {issue(errors,`experience.${use}`,false);continue;}
   keys(counts,WORK_TYPES,errors,`experience.${use}`);
   for (const work of WORK_TYPES) issue(errors,`experience.${use}.${work}`,integer(counts[work],0));
   if (integer(counts['新築'],0) && integer(counts['改修'],0)) issue(errors,`experience.${use}`,Number.isSafeInteger(Number(counts['新築'])+Number(counts['改修'])));
  }
 }
 return errors.length ? {ok:false,errors} : {ok:true,value:value as unknown as PartnerInput};
}
export function validateProject(value: unknown): ValidationResult<ProjectInput> {
 const errors: ValidationError[] = [];
 if (!record(value)) return {ok:false,errors:[{path:'project',message:'案件情報が必要です。'}]};
 keys(value,['name','requiredFields','workType','use','region','floors','floorArea','period','requiredServices','orderType','requireListedLicense'],errors);
 issue(errors,'name',text(value.name,120)); issue(errors,'requiredFields',set(value.requiredFields,FIELDS,true));
 issue(errors,'workType',enumeration(value.workType,WORK_TYPES)); issue(errors,'use',enumeration(value.use,USES));
 issue(errors,'region',isRegionCode(value.region)); issue(errors,'floors',integer(value.floors,1));
 issue(errors,'floorArea',typeof value.floorArea === 'number' && Number.isFinite(value.floorArea) && value.floorArea > 0);
 issue(errors,'requiredServices',set(value.requiredServices,SERVICES)); issue(errors,'orderType',enumeration(value.orderType,ORDER_TYPES));
 issue(errors,'requireListedLicense',typeof value.requireListedLicense === 'boolean');
 const period = validateDateRange(value.period); if (!period.ok) errors.push(...period.errors);
 return errors.length ? {ok:false,errors} : {ok:true,value:value as unknown as ProjectInput};
}
/** Validate domain snapshots without making persisted identity/state part of user input. */
export function projectInput(project: ProjectInput): ProjectInput {
 return {name:project.name,requiredFields:project.requiredFields,workType:project.workType,use:project.use,region:project.region,floors:project.floors,floorArea:project.floorArea,period:project.period,requiredServices:project.requiredServices,orderType:project.orderType,requireListedLicense:project.requireListedLicense};
}
