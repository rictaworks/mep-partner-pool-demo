import type { Assignment, Engagement, EngagementInput, Field, MatchingResult, Partner, PartnerInput, Project, ProjectInput, Region, ValidationError } from '../core';
export const API_PREFIX = '/api';
export const MAX_BODY_BYTES = 32_768;
export const SESSION_COOKIE = 'mep_session';
/** Cookie validation and persistence alone may mint this opaque owner. Never parse from body/query. */
declare const verifiedOwner: unique symbol;
export type VerifiedOwner = string & { readonly [verifiedOwner]: true };
export interface Honeypot { readonly website: string }
export type PartnerRequest = PartnerInput & Honeypot;
export type PartnerUpdateRequest = PartnerRequest & { readonly revision: number };
export type ProjectRequest = ProjectInput & Honeypot;
export type ProjectUpdateRequest = ProjectRequest & { readonly revision: number };
export type EngagementRequest = EngagementInput & Honeypot;
export type CandidateRequest = Honeypot;
export interface AssignmentSelection { readonly partnerId: number; readonly fields: readonly Field[] }
export interface AssignmentRequest extends Honeypot {
 readonly requestId: string;
 readonly projectRevision: number;
 readonly selections: readonly AssignmentSelection[];
}
export interface CancellationRequest extends Honeypot { readonly requestId: string }
export type ApiErrorCode = 'VALIDATION' | 'BAD_JSON' | 'BODY_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'CSRF' | 'CONFLICT' | 'STALE_CANDIDATE' | 'INTERNAL';
export interface ApiError { readonly error: { readonly code: ApiErrorCode; readonly message: string; readonly details?: readonly ValidationError[] } }
export interface ApiData<T> { readonly data: T }
export type RegionsResponse = ApiData<readonly Region[]>;
export type PartnersResponse = ApiData<readonly Partner[]>;
export type PartnerResponse = ApiData<Partner>;
export type ProjectsResponse = ApiData<readonly Project[]>;
export type ProjectResponse = ApiData<Project & { readonly assignments: readonly Assignment[] }>;
export type EngagementsResponse = ApiData<readonly Engagement[]>;
export type EngagementResponse = ApiData<Engagement>;
export type CandidatesResponse = ApiData<MatchingResult & { readonly projectRevision: number }>;
export type AssignmentsResponse = ApiData<{ readonly project: Project; readonly assignments: readonly Assignment[] }>;
