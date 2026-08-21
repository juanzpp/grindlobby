export const MAX_MICROPHONE_GAIN_PERCENT=150;
export const MAX_OUTPUT_VOLUME_PERCENT=100;

export function clampMediaPercent(value:number,max=100){
  if(!Number.isFinite(value))return 0;
  return Math.max(0,Math.min(max,value));
}

export function microphoneLinearGain(percent:number){
  return clampMediaPercent(percent,MAX_MICROPHONE_GAIN_PERCENT)/100;
}

export function perceptualPlaybackGain(percent:number){
  const normalized=clampMediaPercent(percent,MAX_OUTPUT_VOLUME_PERCENT)/100;
  return normalized*normalized;
}

export function bitrateKbpsFromDelta(currentBytes:number,previousBytes:number|null,elapsedMs:number){
  if(previousBytes==null||!Number.isFinite(currentBytes)||!Number.isFinite(previousBytes)||!Number.isFinite(elapsedMs)||elapsedMs<=0||currentBytes<previousBytes)return null;
  return Math.round(((currentBytes-previousBytes)*8)/elapsedMs);
}

export function shouldUseScreenSimulcast(height:number,fps:number){
  return height>=1080||fps>30;
}
