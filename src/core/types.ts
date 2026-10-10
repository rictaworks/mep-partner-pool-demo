/** Domain and JSON values use the same deterministic vocabulary; sets are unique arrays. */
export const FIELDS = ['電気', '機械'] as const;
export const LICENSES = ['設備設計一級建築士', '建築設備士', '1級電気工事施工管理技士', '1級管工事施工管理技士', '一級建築士'] as const;
export const USES = ['教育施設', '公営住宅', '公共施設'] as const;
export const WORK_TYPES = ['新築', '改修'] as const;
export const SERVICES = ['役所打合せ', '定例会出席', '現地調査', '平日電話対応', '納品検査出席', '積算'] as const;
export const ORDER_TYPES = ['入札', 'プロポーザル'] as const;
export type Field = typeof FIELDS[number];
export type License = typeof LICENSES[number];
export type Use = typeof USES[number];
export type WorkType = typeof WORK_TYPES[number];
export type Service = typeof SERVICES[number];
export type OrderType = typeof ORDER_TYPES[number];
export type RegionCode = string;
export interface DateRange { readonly start: string; readonly end: string }
export type Experience = Readonly<Record<Use, Readonly<Record<WorkType, number>>>>;
export interface PartnerInput {
 readonly code: string; readonly shortName: string; readonly fields: readonly Field[];
 readonly licenses: readonly License[]; readonly experience: Experience;
 readonly regions: readonly RegionCode[]; readonly services: readonly Service[];
 readonly capacity: number; readonly active: boolean;
}
export interface Partner extends PartnerInput { readonly id: number; readonly revision: number }
export type ProjectState = 'registered' | 'candidates' | 'partial' | 'assigned';
export interface ProjectInput {
 readonly name: string; readonly requiredFields: readonly Field[]; readonly workType: WorkType;
 readonly use: Use; readonly region: RegionCode; readonly floors: number; readonly floorArea: number;
 readonly period: DateRange; readonly requiredServices: readonly Service[];
 readonly orderType: OrderType; readonly requireListedLicense: boolean;
}
export interface Project extends ProjectInput { readonly id: number; readonly revision: number; readonly state: ProjectState }
export interface EngagementInput { readonly period: DateRange }
export interface Engagement extends EngagementInput {
 readonly id: number; readonly partnerId: number; readonly partnerCode: string; readonly assignmentId: number | null;
}
export interface Assignment {
 readonly id: number; readonly projectId: number; readonly partnerId: number;
 readonly fields: readonly Field[]; readonly requestId: string; readonly status: 'confirmed' | 'cancelled';
}
export interface CandidateBasis {
 readonly exactExperience: number; readonly useExperience: number; readonly spareCapacity: number;
 readonly licenses: readonly License[];
}
export interface Candidate {
 readonly rank: number; readonly kind: 'single' | 'pair';
 /** Single has one code; pair uses electrical then mechanical. */
 readonly partnerCodes: readonly string[];
 readonly electrical: string | null; readonly mechanical: string | null;
 readonly basis: CandidateBasis; readonly notes: readonly string[];
}
export type Requirement = '受付状態' | '地域' | '稼働' | '分野' | '法定資格' | '実施体制資格' | '担当分野' | Service;
export interface Exclusion { readonly partnerCode: string; readonly failedRequirements: readonly Requirement[] }
export type HardCheckResult = Exclusion;
export interface DerivedRequirements {
 readonly statutoryLicense: boolean; readonly listedLicenseByField: Readonly<Partial<Record<Field, readonly License[]>>>;
 readonly autoServices: readonly Service[]; readonly requiredServices: readonly Service[];
}
export type Derived = DerivedRequirements;
export type RelaxableRequirement = '地域' | '稼働' | Service;
export interface Relaxation { readonly relaxedRequirements: readonly RelaxableRequirement[]; readonly candidateCount: number }
export interface MatchingResult {
 readonly candidates: readonly Candidate[]; readonly exclusions: readonly Exclusion[];
 readonly derived: DerivedRequirements; readonly relaxations: readonly Relaxation[];
 readonly poolInsufficient: boolean;
}
export interface ValidationError { readonly path: string; readonly message: string }
export type ValidationResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly ValidationError[] };
