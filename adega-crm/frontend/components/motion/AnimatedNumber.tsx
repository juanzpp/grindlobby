'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap, prefersReducedMotion, setMotionHint, clearMotionHint } from '@/lib/animations/gsap';
import { formatAnimatedNumber, type NumberPresentation } from '@/lib/animations/numbers';

export default function AnimatedNumber({
  value,
  presentation = 'currency',
  suffix = '',
  duration = 0.78,
}: {
  value: number;
  presentation?: NumberPresentation;
  suffix?: string;
  duration?: number;
}) {
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const previousValue = useRef(0);
  const hasAnimated = useRef(false);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const from = hasAnimated.current ? previousValue.current : 0;
    previousValue.current = value;
    hasAnimated.current = true;
    if (prefersReducedMotion() || from === value) {
      element.textContent = `${formatAnimatedNumber(value, presentation)}${suffix}`;
      return;
    }
    const proxy = { value: from };
    setMotionHint(element, 'contents');
    element.textContent = `${formatAnimatedNumber(from, presentation)}${suffix}`;
    const tween = gsap.to(proxy, {
      value,
      duration,
      ease: 'power2.out',
      overwrite: true,
      onUpdate: () => { element.textContent = `${formatAnimatedNumber(proxy.value, presentation)}${suffix}`; },
      onComplete: () => clearMotionHint(element),
    });
    return () => { tween.kill(); };
  }, [duration, presentation, suffix, value]);

  return <span ref={elementRef}>{formatAnimatedNumber(value, presentation)}{suffix}</span>;
}
