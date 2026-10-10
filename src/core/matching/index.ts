import { FIELDS, SERVICES } from '../types';
import { projectInput, validateProject } from '../validation';
import { coversRegion } from '../regions';
import type { Candidate, CandidateBasis, DerivedRequirements, Engagement, Field, License, MatchingResult, Partner, ProjectInput, RelaxableRequirement, Requirement } from '../types';
const FIELD_LICENSES:Readonly<Record<Field,readonly License[]>>={
 '電気':['建築設備士','設備設計一級建築士','1級電気工事施工管理技士'],
 '機械':['建築設備士','設備設計一級建築士','1級管工事施工管理技士'],
};
export function derive(project:ProjectInput):DerivedRequirements {
 const survey=project.workType==='改修';
 return {statutoryLicense:project.floors>=3&&project.floorArea>5000,
 listedLicenseByField:project.requireListedLicense?Object.fromEntries(project.requiredFields.map(f=>[f,FIELD_LICENSES[f]])):{},
 autoServices:survey?['現地調査']:[],requiredServices:SERVICES.filter(s=>project.requiredServices.includes(s)||(survey&&s==='現地調査'))};
}
export function overlaps(a:{readonly start:string;readonly end:string},b:{readonly start:string;readonly end:string}):boolean {return a.start<=b.end&&b.start<=a.end;}
function countLoads(partner:Partner,project:ProjectInput,engagements:readonly Engagement[]):number{return engagements.filter(e=>e.partnerCode===partner.code&&overlaps(e.period,project.period)).length;}
function hasRole(partner:Partner,field:Field,project:ProjectInput):boolean{return partner.fields.includes(field)&&(!project.requireListedLicense||FIELD_LICENSES[field].some(l=>partner.licenses.includes(l)));}
function commonFailures(partner:Partner,project:ProjectInput,engagements:readonly Engagement[],derived:DerivedRequirements,relaxed:readonly RelaxableRequirement[]):Requirement[]{
 const failed:Requirement[]=[];
 if(!partner.active)failed.push('受付状態');
 if(!relaxed.includes('地域')&&!coversRegion(partner.regions,project.region))failed.push('地域');
 for(const service of derived.requiredServices)if(!relaxed.includes(service)&&!partner.services.includes(service))failed.push(service);
 if(!relaxed.includes('稼働')&&countLoads(partner,project,engagements)>=partner.capacity)failed.push('稼働');
 if(!project.requiredFields.some(f=>partner.fields.includes(f)))failed.push('分野');
 return failed;
}
function compareText(a:string,b:string):number{return a<b?-1:a>b?1:0;}
function compareCandidates(a:Candidate,b:Candidate):number {
 return b.basis.exactExperience-a.basis.exactExperience||b.basis.useExperience-a.basis.useExperience||b.basis.spareCapacity-a.basis.spareCapacity||Number(a.kind==='pair')-Number(b.kind==='pair')||compareText(a.partnerCodes[0]??'',b.partnerCodes[0]??'')||compareText(a.partnerCodes[1]??'',b.partnerCodes[1]??'');
}
function basis(offices:readonly Partner[],project:ProjectInput,engagements:readonly Engagement[]):CandidateBasis{
 return {exactExperience:Math.min(...offices.map(o=>o.experience[project.use][project.workType])),useExperience:Math.min(...offices.map(o=>o.experience[project.use]['新築']+o.experience[project.use]['改修'])),spareCapacity:Math.min(...offices.map(o=>o.capacity-countLoads(o,project,engagements))),licenses:Array.from(new Set(offices.flatMap(o=>o.licenses))).sort(compareText)};
}
function compose(project:ProjectInput,partners:readonly Partner[],engagements:readonly Engagement[],derived:DerivedRequirements,relaxed:readonly RelaxableRequirement[]):Candidate[]{
 const eligible=partners.filter(o=>commonFailures(o,project,engagements,derived,relaxed).length===0);
 const candidates:Candidate[]=[];
 function add(offices:readonly Partner[],electrical:string|null,mechanical:string|null):void{
  const score=basis(offices,project,engagements);
  candidates.push({rank:0,kind:offices.length===1?'single':'pair',partnerCodes:offices.map(o=>o.code),electrical,mechanical,basis:score,notes:score.exactExperience===0?['実績なし']:[]});
 }
 for(const office of eligible){
  if(project.requiredFields.every(f=>hasRole(office,f,project))&&(!derived.statutoryLicense||office.licenses.includes('設備設計一級建築士'))){
   add([office],project.requiredFields.includes('電気')?office.code:null,project.requiredFields.includes('機械')?office.code:null);
  }
 }
 if(FIELDS.every(f=>project.requiredFields.includes(f))){
  for(const electric of eligible.filter(o=>hasRole(o,'電気',project))){
   for(const mechanical of eligible.filter(o=>hasRole(o,'機械',project))){
    if(electric.code===mechanical.code)continue;
    if(derived.statutoryLicense&&!electric.licenses.includes('設備設計一級建築士')&&!mechanical.licenses.includes('設備設計一級建築士'))continue;
    add([electric,mechanical],electric.code,mechanical.code);
   }
  }
 }
 return candidates.sort(compareCandidates);
}
/** Deterministic, stateless matching. Input arrays/objects are never changed. */
function limited(candidates:readonly Candidate[]):Candidate[]{
 let pairs=0;
 return candidates.filter(c=>c.kind==='single'||++pairs<=20).map((c,index)=>({...c,rank:index+1}));
}
export function match(project:ProjectInput,partners:readonly Partner[],engagements:readonly Engagement[]):MatchingResult{
 const validation=validateProject(projectInput(project));
 if(!validation.ok)throw new Error('案件条件の入力値が不正です。');
 const derived=derive(project);
 const all=compose(project,partners,engagements,derived,[]);
 const candidates=limited(all);
 // Membership is checked before truncation: a valid lower-ranked pair is not an exclusion.
 const memberCodes=new Set(all.flatMap(c=>c.partnerCodes));
 const exclusions=partners.map(partner=>{
  if(memberCodes.has(partner.code))return {partnerCode:partner.code,failedRequirements:[]};
  const failed=commonFailures(partner,project,engagements,derived,[]);
  if(derived.statutoryLicense&&!partner.licenses.includes('設備設計一級建築士'))failed.push('法定資格');
  if(project.requireListedLicense&&project.requiredFields.some(f=>partner.fields.includes(f)&&!hasRole(partner,f,project)))failed.push('実施体制資格');
  if(!project.requiredFields.every(f=>hasRole(partner,f,project)))failed.push('担当分野');
  if(failed.length===0)failed.push('担当分野');
  return {partnerCode:partner.code,failedRequirements:Array.from(new Set(failed))};
 }).sort((a,b)=>compareText(a.partnerCode,b.partnerCode));
 const relaxations:MatchingResult['relaxations'][number][]=[];
 if(candidates.length===0){
  const options:RelaxableRequirement[]=['地域',...derived.requiredServices,'稼働'];
  for(const condition of options){const count=limited(compose(project,partners,engagements,derived,[condition])).length;if(count>0)relaxations.push({relaxedRequirements:[condition],candidateCount:count});}
  if(relaxations.length===0)for(let i=0;i<options.length;i++)for(let j=i+1;j<options.length;j++){
   const conditions=[options[i]!,options[j]!];const count=limited(compose(project,partners,engagements,derived,conditions)).length;
   if(count>0)relaxations.push({relaxedRequirements:conditions,candidateCount:count});
  }
 }
 return {candidates,exclusions,derived,relaxations,poolInsufficient:candidates.length===0&&relaxations.length===0};
}
