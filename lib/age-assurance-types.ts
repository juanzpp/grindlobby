export const AGE_BANDS=["under_13","13_15","16_17","18_plus"] as const;
export const AGE_ASSURANCE_STATUSES=["not_started","pending","verified","review_requested","rejected","expired"] as const;

export type AgeBand=(typeof AGE_BANDS)[number];
export type AgeAssuranceStatus=(typeof AGE_ASSURANCE_STATUSES)[number];
export type GuardianLinkStatus="not_required"|"required"|"pending"|"verified"|"rejected"|"expired";
export type AgeExperience="unknown"|"child"|"young_teen"|"older_teen"|"adult";

export type AgeAssuranceSnapshot={
  ageBand:AgeBand|null;
  status:AgeAssuranceStatus;
  verifiedAt:string|null;
  verificationMethod:string|null;
  verificationExpiresAt:string|null;
  guardianLinkStatus:GuardianLinkStatus;
  guardianVerifiedAt:string|null;
};

export type AgeCapabilities={
  onboardingRequired:boolean;
  guardianRequired:boolean;
  isVerified:boolean;
  canRequestReview:boolean;
  experience:AgeExperience;
  canJoinLobbies:boolean;
  canUseVoice:boolean;
  canScreenShare:boolean;
  canPurchase:boolean;
  reason:string|null;
};
