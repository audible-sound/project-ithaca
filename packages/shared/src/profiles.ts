export interface IdealCustomerProfileInput {
  name: string;
  industries?: string[];
  /** Industries that score as no fit. */
  industriesExclude?: string[];
  locations?: string[];
  companySizeMin?: number;
  companySizeMax?: number;
  businessNeedKeywords?: string[];
  /** Spend limit used only when qualifying a lead. Omitted when unrestricted. */
  budgetCurrency?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetNotes?: string;
  /** Need statement used only when qualifying a lead. Omitted when unrestricted. */
  businessNeedDescription?: string;
  outreachTone?: string;
  messageConstraints?: string;
}

export interface CreateIdealCustomerProfileRequest extends IdealCustomerProfileInput {
  isActive?: boolean;
  country?: string;
  region?: string;
  city?: string;
}

export interface IdealCustomerProfile {
  icpId: string;
  name: string;
  industries: string[];
  industriesExclude: string[];
  locations: string[];
  country: string;
  region: string;
  city: string;
  companySizeMin: number | null;
  companySizeMax: number | null;
  budgetCurrency: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetNotes: string;
  businessNeedKeywords: string[];
  businessNeedDescription: string;
  outreachTone: string | null;
  messageConstraints: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateIdealCustomerProfileResponse {
  message: string;
  profile: IdealCustomerProfile;
}

export interface ListIdealCustomerProfilesResponse {
  profiles: IdealCustomerProfile[];
}

export type UpdateIdealCustomerProfileRequest = Omit<
  CreateIdealCustomerProfileRequest,
  "isActive"
>;

export interface UpdateIdealCustomerProfileResponse {
  message: string;
  profile: IdealCustomerProfile;
}

export interface UpdateIdealCustomerProfileActiveRequest {
  isActive: boolean;
}

export interface UpdateIdealCustomerProfileActiveResponse {
  profile: IdealCustomerProfile;
}

export interface DeleteIdealCustomerProfileResponse {
  message: string;
}
