import {createAdminClient} from "@/lib/supabase/admin";
import type {
  AgeAssuranceSnapshot,
  AgeAssuranceStatus,
  AgeBand,
  AgeCapabilities,
  AgeExperience,
  GuardianLinkStatus,
} from "@/lib/age-assurance-types";
import {
  AgeVerificationProvider,
  OnboardingFallbackAgeVerificationProvider,
  assertAgeVerificationDecision,
  type AgeVerificationDecision,
} from "@/lib/age-verification-provider";

export const ageVerificationProvider:AgeVerificationProvider=new OnboardingFallbackAgeVerificationProvider();

const emptySnapshot:AgeAssuranceSnapshot={
  ageBand:null,
  status:"not_started",
  verifiedAt:null,
  verificationMethod:null,
  verificationExpiresAt:null,
  guardianLinkStatus:"not_required",
  guardianVerifiedAt:null,
};

function guardianStatusFromLink(
  ageBand:AgeBand|null,
  link:{status:string;verified_at:string|null}|null,
):{status:GuardianLinkStatus;verifiedAt:string|null}{
  const guardianRequired=ageBand==="under_13"||ageBand==="13_15";
  if(!guardianRequired)return {status:"not_required",verifiedAt:null};
  if(!link)return {status:"required",verifiedAt:null};
  if(link.status==="accepted"&&link.verified_at)return {status:"verified",verifiedAt:link.verified_at};
  if(link.status==="revoked")return {status:"rejected",verifiedAt:null};
  if(link.status==="expired")return {status:"expired",verifiedAt:null};
  return {status:"pending",verifiedAt:null};
}

function experienceFromBand(ageBand:AgeBand|null):AgeExperience{
  if(ageBand==="under_13")return "child";
  if(ageBand==="13_15")return "young_teen";
  if(ageBand==="16_17")return "older_teen";
  if(ageBand==="18_plus")return "adult";
  return "unknown";
}

export async function beginAgeVerification(userId:string,ageBand:AgeBand):Promise<AgeVerificationDecision>{
  const decision=await ageVerificationProvider.begin({userId,onboardingAgeBand:ageBand});
  return assertAgeVerificationDecision(ageVerificationProvider,decision);
}

export async function requestAgeVerificationReview(userId:string,currentAgeBand:AgeBand):Promise<AgeVerificationDecision>{
  const decision=await ageVerificationProvider.requestReview({userId,currentAgeBand});
  return assertAgeVerificationDecision(ageVerificationProvider,decision);
}

export async function getAgeAssurance(userId:string):Promise<AgeAssuranceSnapshot>{
  const admin=createAdminClient();
  const assuranceResult=await admin
    .from("age_assurance")
    .select("age_band,age_assurance_status,age_verified_at,age_verification_method,age_verification_expires_at")
    .eq("user_id",userId)
    .maybeSingle();
  if(assuranceResult.error)throw new Error("age_assurance_read_failed");
  if(!assuranceResult.data)return emptySnapshot;

  const ageBand=assuranceResult.data.age_band as AgeBand|null;
  let guardianLink:{status:string;verified_at:string|null}|null=null;
  if(ageBand==="under_13"||ageBand==="13_15"){
    const guardianResult=await admin
      .from("guardian_links")
      .select("status,verified_at")
      .eq("minor_user_id",userId)
      .order("created_at",{ascending:false})
      .limit(1)
      .maybeSingle();
    if(guardianResult.error)throw new Error("guardian_link_read_failed");
    guardianLink=guardianResult.data;
  }
  const guardian=guardianStatusFromLink(ageBand,guardianLink);

  return {
    ageBand,
    status:assuranceResult.data.age_assurance_status as AgeAssuranceStatus,
    verifiedAt:assuranceResult.data.age_verified_at,
    verificationMethod:assuranceResult.data.age_verification_method,
    verificationExpiresAt:assuranceResult.data.age_verification_expires_at,
    guardianLinkStatus:guardian.status,
    guardianVerifiedAt:guardian.verifiedAt,
  };
}

export function getAgeCapabilities(snapshot:AgeAssuranceSnapshot):AgeCapabilities{
  const onboardingRequired=snapshot.status==="not_started"||!snapshot.ageBand;
  const guardianRequired=snapshot.ageBand==="under_13"||snapshot.ageBand==="13_15";
  const guardianApproved=snapshot.guardianLinkStatus==="verified"&&Boolean(snapshot.guardianVerifiedAt);
  const assuranceBlocked=snapshot.status==="rejected"||snapshot.status==="expired";
  const blocked=assuranceBlocked||onboardingRequired||(guardianRequired&&!guardianApproved);
  const fallbackMethod=snapshot.verificationMethod?.startsWith("onboarding_fallback")??false;
  const isVerified=snapshot.status==="verified"&&Boolean(snapshot.verifiedAt)&&!fallbackMethod;
  const reason=onboardingRequired
    ?"Conclua a etapa inicial de aferição etária."
    :assuranceBlocked
      ?"A aferição etária precisa ser revisada."
      :guardianRequired&&!guardianApproved
        ?"A validação do responsável é necessária para liberar este recurso."
        :snapshot.status==="review_requested"
          ?"Sua faixa etária está em revisão; recursos compatíveis permanecem disponíveis."
          :null;
  return {
    onboardingRequired,
    guardianRequired,
    isVerified,
    canRequestReview:Boolean(snapshot.ageBand)&&snapshot.status!=="review_requested",
    experience:experienceFromBand(snapshot.ageBand),
    canJoinLobbies:!blocked,
    canUseVoice:!blocked,
    canScreenShare:!blocked,
    canPurchase:!blocked&&isVerified&&snapshot.ageBand==="18_plus",
    reason,
  };
}
