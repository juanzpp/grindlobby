'use client';

import { gsap } from 'gsap';

export const MOBILE_MOTION_QUERY = '(max-width: 820px) and (prefers-reduced-motion: no-preference)';
export const FULL_MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

let scrollTriggerPromise: Promise<typeof import('gsap/ScrollTrigger').ScrollTrigger | null> | null = null;

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isMobileMotionViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MOTION_QUERY).matches;
}

export async function getScrollTrigger() {
  if (typeof window === 'undefined') return null;
  if (!scrollTriggerPromise) {
    scrollTriggerPromise = import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      gsap.registerPlugin(ScrollTrigger);
      return ScrollTrigger;
    });
  }
  return scrollTriggerPromise;
}

export function setMotionHint(targets: gsap.TweenTarget, value = 'transform,opacity') {
  gsap.set(targets, { willChange: value });
}

export function clearMotionHint(targets: gsap.TweenTarget) {
  gsap.set(targets, { clearProps: 'willChange' });
}

export { gsap };
