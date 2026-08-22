export type ScreenShareTier="free"|"pro";

export type ScreenSharePolicy={
  tier:ScreenShareTier;
  maxWidth:number;
  maxHeight:number;
  maxFps:number;
  maxBitrate:number;
};

const policies:Record<ScreenShareTier,ScreenSharePolicy>={
  free:{tier:"free",maxWidth:1280,maxHeight:720,maxFps:30,maxBitrate:3_200_000},
  pro:{tier:"pro",maxWidth:1920,maxHeight:1080,maxFps:60,maxBitrate:7_500_000},
};

export function getScreenSharePolicy(pro:boolean):ScreenSharePolicy{
  return policies[pro?"pro":"free"];
}

export function isResolutionWithinPolicy(
  width:number,
  height:number,
  policy:Pick<ScreenSharePolicy,"maxWidth"|"maxHeight">,
){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return false;
  const longEdge=Math.max(width,height);
  const shortEdge=Math.min(width,height);
  return longEdge<=policy.maxWidth&&shortEdge<=policy.maxHeight;
}

export function isBitrateWithinPolicy(
  bitrate:number,
  policy:Pick<ScreenSharePolicy,"maxBitrate">,
){
  if(!Number.isFinite(bitrate)||bitrate<=0)return true;
  return bitrate<=policy.maxBitrate;
}
