import { expect, it } from 'vitest';
import { validateProject, validatePartner, validateDateRange } from '../../src/core/validation';
const project = {name:'案件A',requiredFields:['電気'],workType:'新築',use:'公共施設',region:'13101',floors:3,floorArea:5000,period:{start:'2028-02-29',end:'2028-03-01'},requiredServices:[],orderType:'入札',requireListedLicense:false};
const experience = {'教育施設':{'新築':0,'改修':0},'公営住宅':{'新築':0,'改修':0},'公共施設':{'新築':0,'改修':0}};
const partner = {code:'P01',shortName:'架空A',fields:['電気'],licenses:[],experience,regions:['13-all'],services:[],capacity:0,active:true};
it('accepts complete valid values without mutating inputs',()=>{const before = JSON.stringify({project,partner}); expect(validateProject(project).ok).toBe(true);expect(validatePartner(partner).ok).toBe(true);expect(JSON.stringify({project,partner})).toBe(before);});
it.each([{},null,{...project,requiredFields:[]},{...project,requiredFields:['unknown']},{...project,region:'13-all'},{...project,workType:'unknown'},{...project,floors:0},{...project,floors:1.5},{...project,floorArea:NaN},{...project,floorArea:Infinity},{...project,floorArea:-1},{...project,owner:'spoof'},{...project,period:{start:'2027-02-29',end:'2028-03-01'}}])('rejects invalid project %#',value=>{expect(validateProject(value).ok).toBe(false);});
it.each([-1,1.1,NaN,Infinity])('rejects capacity %s',capacity=>{expect(validatePartner({...partner,capacity}).ok).toBe(false);});
it('validates every experience slot and rejects unknown/duplicate values',()=>{
 expect(validatePartner({...partner,experience:{}}).ok).toBe(false);
 expect(validatePartner({...partner,experience:{...experience,'公共施設':{'新築':-1,'改修':0}}}).ok).toBe(false);
 expect(validatePartner({...partner,fields:['電気','電気']}).ok).toBe(false);
 expect(validatePartner({...partner,licenses:['unknown']}).ok).toBe(false);
});
it.each([{start:'2028-02-29',end:'2028-02-29'},{start:'2000-02-29',end:'2000-03-01'}])('accepts leap day and inclusive endpoints',v=>{expect(validateDateRange(v).ok).toBe(true);});
it.each([{start:'1900-02-29',end:'1900-03-01'},{start:'2026-04-31',end:'2026-05-01'},{start:'2026-01-02',end:'2026-01-01'},{start:'2026-1-01',end:'2026-01-02'},{start:'0000-01-01',end:'0000-01-02'}])('rejects invalid date range',v=>{expect(validateDateRange(v).ok).toBe(false);});
it.each([{...project,use:'unknown'},{...project,orderType:'unknown'},{...project,requiredServices:['unknown']},{...project,requireListedLicense:'false'},{...project,name:''},{...project,name:'x'.repeat(121)},{...project,floors:Number.MAX_SAFE_INTEGER+1}])('rejects enum and identity boundaries',v=>{expect(validateProject(v).ok).toBe(false);});
it.each([{...partner,capacity:Number.MAX_SAFE_INTEGER+1},{...partner,code:'../x'},{...partner,code:'x'.repeat(33)},{...partner,shortName:'x'.repeat(81)},{...partner,regions:['unknown']},{...partner,active:1},{...partner,services:['unknown']},{...partner,experience:{...experience,unknown:{新築:0,改修:0}}},{...partner,experience:{...experience,'公共施設':{新築:0,改修:0,unknown:0}}}])('rejects partner strict boundaries',v=>{expect(validatePartner(v).ok).toBe(false);});
it('rejects experience totals outside exact integer arithmetic',()=>{
 expect(validatePartner({...partner,experience:{...experience,'公共施設':{'新築':Number.MAX_SAFE_INTEGER,'改修':1}}}).ok).toBe(false);
});
