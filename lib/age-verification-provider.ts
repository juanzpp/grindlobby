import type {AgeAssuranceStatus,AgeBand} from "@/lib/age-assurance-types";

export type AgeVerificationDecision={
  ageBand:AgeBand;
  status:AgeAssuranceStatus;
  method:string;
  verifiedAt:string|null;
  expiresAt:string|null;
};

export type BeginAgeVerificationInput={
  userId:string;
  onboardingAgeBand:AgeBand;
};

export type RequestAgeReviewInput={
  userId:string;
  currentAgeBand:AgeBand;
};

/**
 * Integration boundary for a future trustworthy age-assurance service.
 * Implementations return only the minimum persisted result; raw evidence must
 * never cross this boundary into the GrindLobby database.
 */
export abstract class AgeVerificationProvider{
  abstract readonly providerId:string;
  abstract readonly trusted:boolean;
  abstract begin(input:BeginAgeVerificationInput):Promise<AgeVerificationDecision>;
  abstract requestReview(input:RequestAgeReviewInput):Promise<AgeVerificationDecision>;
}

/**
 * Temporary onboarding fallback. A selected band can personalize and gate the
 * experience, but this provider is deliberately incapable of verifying age.
 */
export class OnboardingFallbackAgeVerificationProvider extends AgeVerificationProvider{
  readonly providerId="onboarding_fallback";
  readonly trusted=false;

  async begin({onboardingAgeBand}:BeginAgeVerificationInput):Promise<AgeVerificationDecision>{
    return {
      ageBand:onboardingAgeBand,
      status:"pending",
      method:this.providerId,
      verifiedAt:null,
      expiresAt:null,
    };
  }

  async requestReview({currentAgeBand}:RequestAgeReviewInput):Promise<AgeVerificationDecision>{
    return {
      ageBand:currentAgeBand,
      status:"review_requested",
      method:`${this.providerId}_review`,
      verifiedAt:null,
      expiresAt:null,
    };
  }
}

export function assertAgeVerificationDecision(
  provider:AgeVerificationProvider,
  decision:AgeVerificationDecision,
):AgeVerificationDecision{
  if(!provider.trusted&&(decision.status==="verified"||decision.verifiedAt!==null)){
    throw new Error("untrusted_age_provider_cannot_verify");
  }
  if(decision.status==="verified"&&!decision.verifiedAt){
    throw new Error("verified_age_decision_requires_timestamp");
  }
  return decision;
}
