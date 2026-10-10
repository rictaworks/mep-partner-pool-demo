import { describe, expect, it } from 'vitest';
import { match } from '../../../src/core/matching';
import type { Partner, ProjectInput, Engagement } from '../../../src/core';
const project:ProjectInput={name:'架空案件',requiredFields:['電気','機械'],workType:'新築',use:'公共施設',region:'13101',floors:3,floorArea:5000,period:{start:'2027-04-01',end:'2027-05-01'},requiredServices:[],orderType:'入札',requireListedLicense:false};
function office(code:string,extra:Partial<Partner>={}):Partner{return {id:Number(code.replace(/\D/g,''))||1,revision:0,code,shortName:'架空',fields:['電気','機械'],licenses:[],regions:['13-all'],services:['現地調査'],capacity:2,active:true,experience:{'教育施設':{'新築':0,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':0,'改修':0}},...extra};}
function load(code:string,start:string,end:string):Engagement{return {id:1,partnerId:1,partnerCode:code,assignmentId:null,period:{start,end}};}
describe('matching',()=>{
 it('validates before matching',()=>{expect(()=>match({...project,floorArea:0},[],[])).toThrow();expect(()=>match({...project,region:'13-all'},[],[])).toThrow();});
 it.each([[2,5001,false],[3,5000,false],[3,5000.1,true]])('derives statutory boundary %s %s', (floors,floorArea,required)=>{const r=match({...project,floors,floorArea},[office('P1')],[]);expect(r.derived.statutoryLicense).toBe(required);expect(r.candidates.length>0).toBe(!required);});
 it('marks renovation auto survey, evaluates every exclusion, preserves inputs',()=>{const p={...project,workType:'改修' as const,requiredServices:['積算' as const]};const o=office('P1',{active:false,regions:[],services:[],capacity:0,fields:['電気']});const before=JSON.stringify([p,o]);const r=match(p,[o],[]);expect(r.derived.autoServices).toEqual(['現地調査']);expect(r.exclusions[0]?.failedRequirements).toEqual(expect.arrayContaining(['受付状態','地域','積算','現地調査','稼働']));expect(JSON.stringify([p,o])).toBe(before);});
 it('treats inclusive endpoints as overlap and counts all intersecting engagements',()=>{const o=office('P1',{capacity:1});expect(match(project,[o],[load('P1','2027-03-01','2027-04-01')]).candidates).toHaveLength(0);expect(match(project,[o],[load('P1','2027-03-01','2027-03-31')]).candidates).toHaveLength(1);expect(match(project,[o],[load('Other','2027-04-01','2027-05-01')]).candidates).toHaveLength(1);});
 it('capacity zero excludes even without engagements and city mismatch excludes',()=>{expect(match(project,[office('P1',{capacity:0})],[]).candidates).toHaveLength(0);expect(match(project,[office('P1',{regions:['14-all']})],[]).candidates).toHaveLength(0);});
 it('pairs split field licenses and statutory license, never same office',()=>{const p={...project,floorArea:5001,requireListedLicense:true};const e=office('E1',{fields:['電気'],licenses:['1級電気工事施工管理技士']});const m=office('M2',{fields:['機械'],licenses:['設備設計一級建築士']});const r=match(p,[e,m],[]);expect(r.candidates).toHaveLength(1);expect(r.candidates[0]).toMatchObject({kind:'pair',electrical:'E1',mechanical:'M2'});expect(r.exclusions.every(x=>x.failedRequirements.length===0)).toBe(true);expect(match(p,[office('P1',{licenses:['設備設計一級建築士']})],[]).candidates).toHaveLength(1);});
 it('does not substitute the mechanical qualification for electrical, permits dual-office role swap',()=>{const p={...project,requireListedLicense:true};expect(match(p,[office('P1',{fields:['電気'],licenses:['1級管工事施工管理技士']}),office('P2',{fields:['機械'],licenses:['建築設備士']})],[]).candidates).toHaveLength(0);const r=match(p,[office('P1',{licenses:['1級管工事施工管理技士']}),office('P2',{licenses:['1級電気工事施工管理技士']})],[]);expect(r.candidates).toHaveLength(1);expect(r.candidates[0]).toMatchObject({electrical:'P2',mechanical:'P1'});});
 it('includes zero experience notes, ranks singles first on tie and codes deterministically',()=>{const a=office('A1'),b=office('B2');const first=match(project,[b,a],[]);expect(first.candidates.slice(0,2).map(c=>c.partnerCodes[0])).toEqual(['A1','B2']);expect(first.candidates[0]?.notes).toContain('実績なし');expect(match(project,[a,b],[])).toEqual(first);});
 it('ranks exact experience before use totals before spare capacity',()=>{const a=office('A1',{capacity:10}),b=office('B2',{capacity:3}),c=office('C3',{capacity:2});const r=match({...project,requiredFields:['電気']},[a,{...b,experience:{...b.experience,'公共施設':{'新築':0,'改修':5}}},{...c,experience:{...c.experience,'公共施設':{'新築':1,'改修':0}}}],[]);expect(r.candidates.map(x=>x.partnerCodes[0])).toEqual(['C3','B2','A1']);});
 it('uses weaker partner scores and limits pairs after ranking to 20',()=>{const offices=Array.from({length:8},(_,i)=>office(`P${i}`,{experience:{'教育施設':{'新築':0,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':i,'改修':0}}}));const r=match(project,offices,[]);expect(r.candidates.filter(x=>x.kind==='single')).toHaveLength(8);const pairs=r.candidates.filter(x=>x.kind==='pair');expect(pairs).toHaveLength(20);expect(pairs[0]?.basis.exactExperience).toBe(6);expect(pairs[0]?.electrical).toBe('P6');expect(pairs[0]?.mechanical).toBe('P7');});
 it('returns minimum one-condition relaxations only and never changes project',()=>{const o=office('P1',{regions:[]});const r=match(project,[o],[]);expect(r.relaxations).toEqual([{relaxedRequirements:['地域'],candidateCount:1}]);expect(r.poolInsufficient).toBe(false);});
 it('tries two conditions only after singles fail, individually relaxes services',()=>{const p={...project,requiredServices:['積算' as const]};const r=match(p,[office('P1',{regions:[]})],[]);expect(r.relaxations).toEqual([{relaxedRequirements:['地域','積算'],candidateCount:1}]);});
 it.each([{active:false},{fields:['電気'] as const},{licenses:[]},{capacity:0,regions:[],services:[]}])('does not relax nonrelaxable constraints or more than two',extra=>{const p={...project,floorArea:5001,requireListedLicense:true,requiredServices:['積算' as const]};const r=match(p,[office('P1',{licenses:['設備設計一級建築士'],...extra})],[]);expect(r.candidates).toHaveLength(0);expect(r.relaxations).toHaveLength(0);expect(r.poolInsufficient).toBe(true);});
});

it('uses spare capacity and both pair code comparisons on complete score ties',()=>{
 const r=match({...project,requiredFields:['電気']},[office('A1',{capacity:1}),office('B2',{capacity:2})],[]);
 expect(r.candidates.map(c=>c.partnerCodes[0])).toEqual(['B2','A1']);
 const pairs=match(project,[office('Z1',{fields:['電気']}),office('B2',{fields:['機械']}),office('A3',{fields:['機械']}),office('Y4',{fields:['電気']})],[]).candidates;
 expect(pairs.map(c=>c.partnerCodes)).toEqual([['Y4','A3'],['Y4','B2'],['Z1','A3'],['Z1','B2']]);
});
it('uses weaker side for pair use-experience and spare-capacity',()=>{
 const strong=office('E1',{fields:['電気'],capacity:10,experience:{'教育施設':{'新築':0,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':4,'改修':9}}});
 const weak=office('M2',{fields:['機械'],capacity:3,experience:{'教育施設':{'新築':0,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':2,'改修':1}}});
 const candidate=match(project,[strong,weak],[load('M2','2027-04-01','2027-05-01')]).candidates[0];
 expect(candidate?.basis).toMatchObject({exactExperience:2,useExperience:3,spareCapacity:2});
});
it('does not relax isolated listed-license failure',()=>{
 const r=match({...project,requireListedLicense:true},[office('P1')],[]);
 expect(r.candidates).toEqual([]);expect(r.relaxations).toEqual([]);expect(r.poolInsufficient).toBe(true);
});
it('applies the same top20 pair limit to relaxation counts',()=>{
 const offices=Array.from({length:8},(_,i)=>office(`P${i}`,{regions:[]}));
 expect(match(project,offices,[]).relaxations).toEqual([{relaxedRequirements:['地域'],candidateCount:28}]);
});
