import {beforeEach,describe,expect,it,vi} from "vitest";
import type {AgeBand} from "@/lib/age-band";

const mocks=vi.hoisted(()=>({
  beginAgeVerification:vi.fn(),
  enforceRateLimit:vi.fn(),
  getAgeAssurance:vi.fn(),
  getAgeCapabilities:vi.fn(),
  getCurrentUser:vi.fn(),
  logSecurityEvent:vi.fn(),
  upsert:vi.fn(),
}));

vi.mock("@/lib/auth",()=>({getCurrentUser:mocks.getCurrentUser}));
vi.mock("@/lib/age-assurance",()=>({
  beginAgeVerification:mocks.beginAgeVerification,
  getAgeAssurance:mocks.getAgeAssurance,
  getAgeCapabilities:mocks.getAgeCapabilities,
  requestAgeVerificationReview:vi.fn(),
}));
vi.mock("@/lib/supabase/admin",()=>({
  createAdminClient:()=>({from:()=>({upsert:mocks.upsert})}),
}));
vi.mock("@/lib/security/rate-limit",()=>{
  class RateLimitExceededError extends Error{}
  class RateLimitUnavailableError extends Error{}
  return {
    enforceRateLimit:mocks.enforceRateLimit,
    RateLimitExceededError,
    RateLimitUnavailableError,
    rateLimitResponse:()=>Response.json({error:"rate_limited"},{status:429}),
  };
});
vi.mock("@/lib/security/logging",()=>({logSecurityEvent:mocks.logSecurityEvent}));

import {POST} from "@/app/api/me/age-assurance/route";

const notStarted={
  ageBand:null,
  status:"not_started",
  verifiedAt:null,
  verificationMethod:null,
  verificationExpiresAt:null,
  guardianLinkStatus:"not_required",
  guardianVerifiedAt:null,
};

function request(body:Record<string,unknown>){
  return new Request("http://render-internal:3000/api/me/age-assurance",{
    method:"POST",
    headers:{
      "content-type":"application/json",
      "origin":"https://grindlobby.onrender.com",
      "sec-fetch-site":"same-origin",
    },
    body:JSON.stringify(body),
  });
}

function arrangeAccepted(ageBand:AgeBand){
  const pending={...notStarted,ageBand,status:"pending",verificationMethod:"onboarding_fallback"};
  mocks.getAgeAssurance.mockResolvedValueOnce(notStarted).mockResolvedValueOnce(pending);
  mocks.beginAgeVerification.mockResolvedValue({
    ageBand,
    status:"pending",
    method:"onboarding_fallback",
    verifiedAt:null,
    expiresAt:null,
  });
}

describe("POST /api/me/age-assurance",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({id:"user-1"});
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.getAgeCapabilities.mockReturnValue({onboardingRequired:false});
    mocks.upsert.mockResolvedValue({error:null});
  });

  it.each(["18_plus","16_17"] as const)("aceita ageBand %s",async ageBand=>{
    arrangeAccepted(ageBand);

    const response=await POST(request({ageBand}));

    expect(response.status).toBe(200);
    expect(mocks.beginAgeVerification).toHaveBeenCalledWith("user-1",ageBand);
  });

  it("rejeita valor inválido com 400",async()=>{
    const response=await POST(request({ageBand:"18_or_more"}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({error:"Selecione uma faixa etária válida."});
    expect(mocks.beginAgeVerification).not.toHaveBeenCalled();
  });

  it("rejeita campo ausente com 400",async()=>{
    const response=await POST(request({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({error:"Selecione uma faixa etária válida."});
    expect(mocks.beginAgeVerification).not.toHaveBeenCalled();
  });
});
