import {createAdminClient} from "@/lib/supabase/admin";
import type {AgeAssuranceSnapshot,AgeBand,AgeCapabilities,AgeAssuranceStatus,GuardianLinkStatus} from "@/lib/age-assurance-types";

export type AgeVerificationDecision={
  status:AgeAssuranceStatus;
  method:string;
  verifiedAt:string|null;
  expiresAt:string|null;
  guardianLinkStatus:GuardianLinkStatus;
};

export interface AgeVerificationProvider{
  begin(input:{userId:string;ageBand:AgeBand}):Promise<AgeVerificationDecision>;
}

class DeferredAgeVerificationProvider implements AgeVerificationProvider{
  async begin({ageBand}: {userId:string;ageBand:AgeBand}):Promise<AgeVerificationDecision>{
    const guardianRequired=ageBand==="under_13"||ageBand==="13_15";
    return {
      status:guardianRequired?"guardian_required":"pending",
      method:"onboarding_age_band",
      verifiedAt:null,
      expiresAt:null,
      guardianLinkStatus:guardianRequired?"required":"not_required",
    };
  }
}

export const ageVerificationProvider:AgeVerificationProvider=new DeferredAgeVerificationProvider();

const emptySnapshot:AgeAssuranceSnapshot={
  ageBand:null,
  status:"not_started",
  verifiedAt:null,
  verificationMethod:null,
  verificationExpiresAt:null,
  guardianLinkStatus:"not_required",
  guardianVerifiedAt:null,
};

export async function getAgeAssurance(userId:string):Promise<AgeAssuranceSnapshot>{
  const admin=createAdminClient();
  const {data}=await admin.from("age_assurance").select("age_band,age_assurance_status,age_verified_at,age_verification_method,age_verification_expires_at,guardian_link_status,guardian_verified_at").eq("user_id",userId).maybeSingle();
  if(!data)return emptySnapshot;
  return {
    ageBand:data.age_band as AgeBand|null,
    status:data.age_assurance_status as AgeAssuranceStatus,
    verifiedAt:data.age_verified_at,
    verificationMethod:data.age_verification_method,
    verificationExpiresAt:data.age_verification_expires_at,
    guardianLinkStatus:data.guardian_link_status as GuardianLinkStatus,
    guardianVerifiedAt:data.guardian_verified_at,
  };
}

export function getAgeCapabilities(snapshot:AgeAssuranceSnapshot):AgeCapabilities{
  const onboardingRequired=snapshot.status==="not_started"||!snapshot.ageBand;
  const guardianRequired=snapshot.ageBand==="under_13"||snapshot.ageBand==="13_15";
  const guardianApproved=snapshot.guardianLinkStatus==="verified"&&Boolean(snapshot.guardianVerifiedAt);
  const blocked=snapshot.status==="rejected"||snapshot.status==="expired"||onboardingRequired||(guardianRequired&&!guardianApproved);
  const reason=onboardingRequired
    ?"Conclua a etapa inicial de aferição etária."
    :snapshot.status==="rejected"||snapshot.status==="expired"
      ?"A aferição etária precisa ser revisada."
      :guardianRequired&&!guardianApproved
        ?"A validação do responsável é necessária para liberar este recurso."
        :null;
  return {
    onboardingRequired,
    guardianRequired,
    canJoinLobbies:!blocked,
    canUseVoice:!blocked,
    canScreenShare:!blocked,
    canPurchase:!blocked&&snapshot.status==="verified"&&snapshot.ageBand==="18_plus",
    reason,
  };
}
